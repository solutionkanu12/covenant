import Fastify from "fastify";
import { productName } from "@covenant/shared";
import { loadSupabaseConfig } from "./config.js";
import { requireAuthentication } from "./auth/middleware.js";
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

type AppOptions = {
  supabase?: SupabaseHttpClient;
  admin?: SupabaseHttpClient;
  now?: () => Date;
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

  app.get("/health", async () => ({
    service: productName,
    status: "ok",
  }));

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

  return app;
}
