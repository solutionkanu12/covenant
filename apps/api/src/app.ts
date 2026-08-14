import Fastify from "fastify";
import { covenantCoston2Deployment, productName } from "@covenant/shared";
import { loadBackendConfig, loadSupabaseConfig } from "./config.js";
import { requireAuthentication } from "./auth/middleware.js";
import { requireAdmin } from "./auth/admin.js";
import {
  createWalletChallenge,
  hashNonce,
  isValidWalletSignature,
} from "./auth/wallet.js";
import {
  createUserSupabaseClient,
  type SupabaseHttpClient,
} from "./supabase/client.js";
import { createSupabaseAdminClient } from "./supabase/admin.js";
import { BackendRepository } from "./backend/repository.js";
import { CovenantIndexer } from "./backend/indexer.js";
import {
  createCoston2EventSource,
  type CovenantEventSource,
} from "./chain/coston2.js";
import { commitmentAnalytics } from "./backend/analytics.js";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  matchesCommittedDestination,
  isValidXrplDestination,
} from "./xrpl/reference.js";
import {
  buildXrplPaymentPayload,
  createXamanPayload,
} from "./xrpl/paymentRequest.js";
import { validateObservedPayment } from "./xrpl/observation.js";
import {
  createXrplTransactionSource,
  type XrplTransactionSource,
} from "./xrpl/client.js";
import type { XamanConfig } from "./config.js";

type BackendServices = {
  repository: BackendRepository;
  indexer: CovenantIndexer;
  eventSource: CovenantEventSource;
  internalApiSecret: string;
  pollIntervalMs?: number;
  xrplTransactionSource: XrplTransactionSource;
  xaman?: XamanConfig;
};

type AppOptions = {
  supabase?: SupabaseHttpClient;
  admin?: SupabaseHttpClient;
  now?: () => Date;
  backend?: BackendServices;
};
type Credentials = { email?: string; password?: string };
type WalletBody = {
  walletAddress?: string;
  challengeId?: string;
  signature?: string;
};

function credentials(body: Credentials) {
  if (
    typeof body.email !== "string" ||
    !body.email.includes("@") ||
    typeof body.password !== "string" ||
    body.password.length < 12
  )
    throw new Error(
      "A valid email and password of at least 12 characters are required",
    );
  return { email: body.email.trim().toLowerCase(), password: body.password };
}

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: true });
  const supabase =
    options.supabase ?? createUserSupabaseClient(loadSupabaseConfig());
  const admin = options.admin ?? createSupabaseAdminClient();
  const authenticated = requireAuthentication(supabase);
  const now = options.now ?? (() => new Date());
  const backend =
    options.backend ??
    (options.supabase || options.admin
      ? undefined
      : (() => {
          const config = loadBackendConfig();
          const repository = new BackendRepository(admin);
          const eventSource = createCoston2EventSource(
            config.coston2RpcUrl,
            covenantCoston2Deployment.covenantEscrow,
          );
          return {
            repository,
            eventSource,
            internalApiSecret: config.internalApiSecret,
            pollIntervalMs: config.indexerPollIntervalMs,
            indexer: new CovenantIndexer(eventSource, repository, {
              chainId: covenantCoston2Deployment.chainId,
              contractAddress: covenantCoston2Deployment.covenantEscrow,
              startBlock: config.indexerStartBlock,
              batchSize: config.indexerBatchSize,
            }),
            xrplTransactionSource: createXrplTransactionSource(
              config.xrplTestnetUrl,
            ),
            xaman: config.xaman,
          };
        })());
  const managesIndexer =
    !options.backend && !options.supabase && !options.admin;
  let indexerTimer: NodeJS.Timeout | undefined;
  let indexerRunning = false;
  const runIndexer = async () => {
    if (!backend || indexerRunning) return;
    indexerRunning = true;
    try {
      const result = await backend.indexer.sync();
      app.log.info(
        {
          fromBlock: result.fromBlock.toString(),
          toBlock: result.toBlock.toString(),
          eventsProcessed: result.eventsProcessed,
          caughtUp: result.caughtUp,
        },
        "Covenant event synchronization completed",
      );
    } catch (error) {
      app.log.error({ err: error }, "Covenant event synchronization failed");
    } finally {
      indexerRunning = false;
    }
  };
  if (managesIndexer && backend) {
    app.addHook("onReady", async () => {
      await runIndexer();
      indexerTimer = setInterval(runIndexer, backend.pollIntervalMs ?? 15_000);
      indexerTimer.unref();
    });
    app.addHook("onClose", async () => {
      if (indexerTimer) clearInterval(indexerTimer);
    });
  }
  const administrator = [authenticated, requireAdmin(backend?.repository)];

  app.get("/health", async (_request, reply) => {
    if (!backend)
      return { service: productName, status: "ok", dependencies: {} };
    const checks = await Promise.allSettled([
      backend.repository.health(),
      backend.eventSource.blockNumber(),
    ]);
    const dependencies = {
      supabase: checks[0].status === "fulfilled" ? "ok" : "error",
      coston2: checks[1].status === "fulfilled" ? "ok" : "error",
    };
    const healthy = Object.values(dependencies).every(
      (value) => value === "ok",
    );
    return reply.code(healthy ? 200 : 503).send({
      service: productName,
      status: healthy ? "ok" : "degraded",
      dependencies,
    });
  });

  app.get<{
    Querystring: { status?: string; wallet?: string; limit?: string };
  }>("/api/commitments", async (request, reply) => {
    if (!backend)
      return reply.code(503).send({ error: "Backend services unavailable" });
    const filters: string[] = [];
    if (request.query.status) {
      if (
        !new Set(["active", "fulfilled", "defaulted"]).has(request.query.status)
      )
        return reply.code(400).send({ error: "Invalid commitment status" });
      filters.push(`status=eq.${request.query.status}`);
    }
    if (request.query.wallet) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(request.query.wallet))
        return reply.code(400).send({ error: "Invalid wallet address" });
      filters.push(
        `or=(payer_flare_address.ilike.${request.query.wallet},recipient_flare_address.ilike.${request.query.wallet})`,
      );
    }
    const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 100);
    if (!Number.isInteger(limit))
      return reply.code(400).send({ error: "Invalid result limit" });
    filters.push("order=created_at.desc", `limit=${limit}`);
    return backend.repository.listCommitments(filters.join("&"));
  });

  app.get<{ Params: { id: string } }>(
    "/api/commitments/:id",
    async (request, reply) => {
      if (!backend)
        return reply.code(503).send({ error: "Backend services unavailable" });
      if (!/^\d+$/.test(request.params.id))
        return reply.code(400).send({ error: "Invalid commitment id" });
      const row = await backend.repository.commitment(
        covenantCoston2Deployment.chainId,
        covenantCoston2Deployment.covenantEscrow,
        request.params.id,
      );
      if (!row) return reply.code(404).send({ error: "Commitment not found" });
      return {
        commitment: row,
        evidence: await backend.repository.settlementEvents(row.id),
      };
    },
  );

  app.post<{ Params: { id: string }; Body: { xrplDestinationAddress?: string } }>(
    "/api/commitments/:id/payment-request",
    async (request, reply) => {
      if (!backend)
        return reply.code(503).send({ error: "Backend services unavailable" });
      if (!/^\d+$/.test(request.params.id))
        return reply.code(400).send({ error: "Invalid commitment id" });
      const commitment = await backend.repository.commitment(
        covenantCoston2Deployment.chainId,
        covenantCoston2Deployment.covenantEscrow,
        request.params.id,
      );
      if (!commitment)
        return reply.code(404).send({ error: "Commitment not found" });
      if (commitment.status !== "active")
        return reply
          .code(409)
          .send({ error: "Commitment is not active" });
      const destination = request.body?.xrplDestinationAddress;
      if (typeof destination !== "string" || !isValidXrplDestination(destination))
        return reply
          .code(400)
          .send({ error: "A valid XRPL destination address is required" });
      if (
        !matchesCommittedDestination(
          destination,
          commitment.recipient_xrpl_address_hash,
        )
      )
        return reply.code(400).send({
          error: "Destination address does not match the committed XRPL destination",
        });
      const payload = buildXrplPaymentPayload({
        destination,
        amountDrops: commitment.xrp_amount_drops,
        paymentReference: commitment.payment_reference,
      });
      if (destination !== commitment.recipient_xrpl_address)
        await backend.repository.updateCommitment(commitment.id, {
          recipient_xrpl_address: destination,
          updated_at: new Date().toISOString(),
        });
      let xaman: { uuid: string; qrPng: string; deeplink: string } | null = null;
      if (backend.xaman) {
        try {
          xaman = await createXamanPayload(backend.xaman, payload);
        } catch (error) {
          app.log.error({ err: error }, "Xaman payload creation failed");
        }
      }
      return {
        commitmentId: request.params.id,
        transaction: payload,
        transactionJson: JSON.stringify(payload, null, 2),
        xaman,
      };
    },
  );

  app.post<{ Params: { id: string }; Body: { transactionHash?: string } }>(
    "/api/commitments/:id/payment-observation",
    async (request, reply) => {
      if (!backend)
        return reply.code(503).send({ error: "Backend services unavailable" });
      if (!/^\d+$/.test(request.params.id))
        return reply.code(400).send({ error: "Invalid commitment id" });
      const transactionHash = request.body?.transactionHash;
      if (
        typeof transactionHash !== "string" ||
        !/^[0-9A-Fa-f]{64}$/.test(transactionHash)
      )
        return reply
          .code(400)
          .send({ error: "A valid XRPL transaction hash is required" });
      const commitment = await backend.repository.commitment(
        covenantCoston2Deployment.chainId,
        covenantCoston2Deployment.covenantEscrow,
        request.params.id,
      );
      if (!commitment)
        return reply.code(404).send({ error: "Commitment not found" });
      const fetched =
        await backend.xrplTransactionSource.fetchTransaction(transactionHash);
      if (!fetched)
        return reply
          .code(404)
          .send({ error: "Transaction not found or not yet validated" });
      const result = validateObservedPayment(
        fetched.transaction,
        fetched.meta,
        fetched.validated,
        {
          destinationHash: commitment.recipient_xrpl_address_hash,
          amountDrops: BigInt(commitment.xrp_amount_drops),
          paymentReference: commitment.payment_reference,
        },
      );
      if (!result.valid)
        return reply.code(422).send({ observed: true, valid: false, errors: result.errors });
      await backend.repository.recordXrplObservation({
        commitment_id: commitment.id,
        transaction_hash: transactionHash.toUpperCase(),
        ledger_index: fetched.ledgerIndex,
        validated: fetched.validated,
        destination: result.destination,
        delivered_amount_drops: result.deliveredAmountDrops,
        payment_reference: commitment.payment_reference,
      });
      return {
        observed: true,
        valid: true,
        ledgerIndex: fetched.ledgerIndex,
        deliveredAmountDrops: result.deliveredAmountDrops,
        destination: result.destination,
        note: "Informational only. Settlement requires a verified FDC proof.",
      };
    },
  );

  app.post<{ Body: Credentials }>(
    "/api/auth/signup",
    async (request, reply) => {
      try {
        const value = credentials(request.body);
        return reply
          .code(201)
          .send(await supabase.signUp(value.email, value.password));
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Sign-up failed",
        });
      }
    },
  );
  app.post<{ Body: Credentials }>(
    "/api/auth/signin",
    async (request, reply) => {
      try {
        const value = credentials(request.body);
        return await supabase.signIn(value.email, value.password);
      } catch {
        return reply.code(401).send({ error: "Invalid email or password" });
      }
    },
  );
  app.get(
    "/api/profile",
    { preHandler: authenticated },
    async (request) =>
      (
        await supabase
          .from("profiles", request.accessToken)
          .select("id,display_name,wallet_address,created_at,updated_at")
      )[0] ?? null,
  );
  app.patch<{ Body: { displayName?: string } }>(
    "/api/profile",
    { preHandler: authenticated },
    async (request, reply) => {
      const displayName = request.body.displayName?.trim();
      if (!displayName || displayName.length > 80)
        return reply
          .code(400)
          .send({ error: "Display name must contain 1 to 80 characters" });
      return (
        await supabase
          .from("profiles", request.accessToken)
          .update(`id=eq.${request.authUser!.id}`, {
            display_name: displayName,
          })
      )[0];
    },
  );
  app.post<{ Body: WalletBody }>(
    "/api/profile/wallet/challenge",
    { preHandler: authenticated },
    async (request, reply) => {
      try {
        const challenge = createWalletChallenge(
          request.authUser!.id,
          request.body.walletAddress ?? "",
          now(),
        );
        const rows = await admin
          .from<{ id: string }>("wallet_link_challenges")
          .insert({
            user_id: request.authUser!.id,
            wallet_address: challenge.address,
            nonce_hash: challenge.nonceHash,
            message: challenge.message,
            expires_at: challenge.expiresAt.toISOString(),
          });
        await admin.from("audit_logs").insert({
          user_id: request.authUser!.id,
          action: "wallet.challenge.created",
          resource_type: "wallet_link_challenge",
          resource_id: rows[0]!.id,
        });
        return reply.code(201).send({
          id: rows[0]!.id,
          message: challenge.message,
          expiresAt: challenge.expiresAt.toISOString(),
        });
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error
              ? error.message
              : "Challenge creation failed",
        });
      }
    },
  );
  app.post<{ Body: WalletBody }>(
    "/api/profile/wallet/verify",
    { preHandler: authenticated },
    async (request, reply) => {
      const { challengeId, signature } = request.body;
      if (!challengeId || !signature?.startsWith("0x"))
        return reply
          .code(400)
          .send({ error: "Challenge and signature are required" });
      const challenges = await admin
        .from<{
          id: string;
          user_id: string;
          wallet_address: string;
          message: string;
          expires_at: string;
          consumed_at: string | null;
        }>("wallet_link_challenges")
        .select(
          "id,user_id,wallet_address,message,expires_at,consumed_at",
          `id=eq.${encodeURIComponent(challengeId)}`,
        );
      const challenge = challenges.find((item) => item.id === challengeId);
      if (
        !challenge ||
        challenge.user_id !== request.authUser!.id ||
        challenge.consumed_at ||
        new Date(challenge.expires_at) <= now()
      )
        return reply
          .code(409)
          .send({ error: "Challenge is invalid, expired, or already used" });
      if (
        !(await isValidWalletSignature(
          challenge.message,
          challenge.wallet_address,
          signature as `0x${string}`,
        ))
      )
        return reply.code(401).send({ error: "Invalid wallet signature" });
      // Conditional consumed_at match makes verification atomic and replay-safe.
      const consumed = await admin
        .from<{ id: string }>("wallet_link_challenges")
        .update(
          `id=eq.${challenge.id}&consumed_at=is.null&nonce_hash=eq.${hashNonce(challenge.message.match(/Nonce: ([0-9a-f]+)/)?.[1] ?? "")}`,
          { consumed_at: now().toISOString() },
        );
      if (consumed.length !== 1)
        return reply.code(409).send({ error: "Challenge was already used" });
      const profile = (
        await admin.from("profiles").update(`id=eq.${request.authUser!.id}`, {
          wallet_address: challenge.wallet_address,
        })
      )[0];
      await admin.from("audit_logs").insert({
        user_id: request.authUser!.id,
        action: "wallet.linked",
        resource_type: "profile",
        resource_id: request.authUser!.id,
        metadata: { wallet_address: challenge.wallet_address },
      });
      return profile;
    },
  );

  app.get(
    "/api/notifications",
    { preHandler: authenticated },
    async (request) =>
      supabase
        .from("notifications", request.accessToken)
        .select(
          "id,kind,title,body,read_at,created_at",
          `user_id=eq.${request.authUser!.id}&order=created_at.desc&limit=100`,
        ),
  );

  app.patch<{ Params: { id: string } }>(
    "/api/notifications/:id/read",
    { preHandler: authenticated },
    async (request, reply) => {
      if (!/^[0-9a-f-]{36}$/i.test(request.params.id))
        return reply.code(400).send({ error: "Invalid notification id" });
      const rows = await supabase
        .from("notifications", request.accessToken)
        .update(
          `id=eq.${request.params.id}&user_id=eq.${request.authUser!.id}`,
          { read_at: now().toISOString() },
        );
      return (
        rows[0] ?? reply.code(404).send({ error: "Notification not found" })
      );
    },
  );

  app.get(
    "/api/admin/analytics",
    { preHandler: administrator },
    async (_request, reply) => {
      if (!backend)
        return reply.code(503).send({ error: "Backend services unavailable" });
      return commitmentAnalytics(
        await backend.repository.listCommitments("limit=10000"),
      );
    },
  );

  app.get(
    "/api/admin/commitments",
    { preHandler: administrator },
    async (_request, reply) => {
      if (!backend)
        return reply.code(503).send({ error: "Backend services unavailable" });
      return backend.repository.listCommitments(
        "order=created_at.desc&limit=1000",
      );
    },
  );

  app.post("/api/indexer/sync", async (request, reply) => {
    if (!backend)
      return reply.code(503).send({ error: "Backend services unavailable" });
    const supplied = request.headers["x-internal-api-secret"];
    const actual = createHash("sha256")
      .update(backend.internalApiSecret)
      .digest();
    const candidate = createHash("sha256")
      .update(typeof supplied === "string" ? supplied : "")
      .digest();
    if (!timingSafeEqual(actual, candidate))
      return reply.code(401).send({ error: "Invalid internal API secret" });
    const result = await backend.indexer.sync();
    return {
      ...result,
      fromBlock: result.fromBlock.toString(),
      toBlock: result.toBlock.toString(),
    };
  });

  return app;
}
