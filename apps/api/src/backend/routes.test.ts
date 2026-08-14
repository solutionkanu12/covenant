import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import type { CovenantIndexer } from "./indexer.js";
import type {
  BackendRepository,
  CommitmentRecord,
  FdcJobRecord,
} from "./repository.js";
import type { CovenantEventSource } from "../chain/coston2.js";
import type { SupabaseHttpClient } from "../supabase/client.js";
import type { XrplTransactionSource } from "../xrpl/client.js";
import type { FdcExecutorDeps } from "../fdc/jobProcessor.js";

const destination = "rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw";
const destinationHash =
  "0x388d4bc2ff8a615fb4f77413d064d649189f618fe8dd9fc68d5d9de4b6c42893";
const paymentReference = `0x${"ab".repeat(32)}`;
const memoData = "AB".repeat(32);

const row = {
  id: "row-1",
  commitment_id: "7",
  status: "active",
  xrp_amount_drops: "1000000",
  fxrp_bond_amount: "200",
  recipient_xrpl_address: null,
  recipient_xrpl_address_hash: destinationHash,
  payment_reference: paymentReference,
} as CommitmentRecord;

function noopXrplSource(): XrplTransactionSource {
  return { fetchTransaction: async () => undefined };
}

function noopFdcDeps(): FdcExecutorDeps {
  return {
    preparePayment: async () => {
      throw new Error("not implemented in this test");
    },
    prepareRpn: async () => {
      throw new Error("not implemented in this test");
    },
    submitRequest: async () => {
      throw new Error("not implemented in this test");
    },
    isRoundFinalized: async () => {
      throw new Error("not implemented in this test");
    },
    fetchProof: async () => {
      throw new Error("not implemented in this test");
    },
    decodePaymentProof: () => {
      throw new Error("not implemented in this test");
    },
    decodeRpnProof: () => {
      throw new Error("not implemented in this test");
    },
    settlePaid: async () => {
      throw new Error("not implemented in this test");
    },
    settleDefault: async () => {
      throw new Error("not implemented in this test");
    },
  };
}

function authClient() {
  return {
    getUser: async (token: string) => {
      if (token === "admin-token") return { id: "admin-user" };
      if (token === "user-token") return { id: "regular-user" };
      throw new Error("invalid");
    },
    from: () => ({
      select: async () => [],
      insert: async () => [],
      update: async () => [],
      upsert: async () => [],
    }),
    signUp: async () => ({}),
    signIn: async () => ({}),
  } as unknown as SupabaseHttpClient;
}

test("backend routes expose public data and protect admin and sync operations", async () => {
  let syncCalls = 0;
  const repository = {
    health: async () => [],
    listCommitments: async () => [row],
    commitment: async (_chain: number, _contract: string, id: string) =>
      id === "7" ? row : null,
    settlementEvents: async () => [],
    isAdmin: async (id: string) => id === "admin-user",
  } as unknown as BackendRepository;
  const indexer = {
    sync: async () => {
      syncCalls += 1;
      return {
        fromBlock: 100n,
        toBlock: 101n,
        eventsProcessed: 2,
        caughtUp: true,
      };
    },
  } as CovenantIndexer;
  const eventSource = {
    blockNumber: async () => 101n,
    events: async () => [],
  } satisfies CovenantEventSource;
  const client = authClient();
  const app = buildApp({
    supabase: client,
    admin: client,
    backend: {
      repository,
      indexer,
      eventSource,
      internalApiSecret: "secret",
      xrplTransactionSource: noopXrplSource(),
      fdcDeps: noopFdcDeps(),
    },
  });

  assert.equal((await app.inject({ url: "/health" })).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/commitments" })).statusCode, 200);
  assert.equal(
    (
      await app.inject({
        url: "/api/admin/analytics",
        headers: { authorization: "Bearer user-token" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ url: "/api/commitments/7" })).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: "/api/admin/analytics" })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/admin/analytics",
        headers: { authorization: "Bearer admin-token" },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ method: "POST", url: "/api/indexer/sync" })).statusCode,
    401,
  );
  const sync = await app.inject({
    method: "POST",
    url: "/api/indexer/sync",
    headers: { "x-internal-api-secret": "secret" },
  });
  assert.equal(sync.statusCode, 200);
  assert.equal(sync.json().fromBlock, "100");
  assert.equal(syncCalls, 1);
  await app.close();
});

function buildPaymentTestApp(overrides: {
  commitment?: CommitmentRecord | null;
  fetchTransaction?: XrplTransactionSource["fetchTransaction"];
  hasObservation?: boolean;
  fdcDeps?: Partial<FdcExecutorDeps>;
} = {}) {
  const commitment =
    overrides.commitment === undefined ? row : overrides.commitment;
  const updateCalls: Array<{ id: string; body: Record<string, unknown> }> = [];
  const observations: Array<Record<string, unknown>> = [];
  const jobsByKey = new Map<string, FdcJobRecord>();
  const jobsById = new Map<string, FdcJobRecord>();
  function job(attestationType: string): FdcJobRecord {
    const id = `00000000-0000-0000-0000-${String(jobsById.size).padStart(12, "0")}`;
    return {
      id,
      commitment_id: "row-1",
      attestation_type: attestationType as FdcJobRecord["attestation_type"],
      request_bytes: null,
      request_tx_hash: null,
      round_id: null,
      status: "queued",
      next_step: null,
      attempt_count: 0,
      proof_json: null,
      settlement_tx_hash: null,
      error_code: null,
      error_message: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
  }
  const repository = {
    commitment: async (_chain: number, _contract: string, id: string) =>
      id === "7" ? commitment : null,
    commitmentById: async () => commitment,
    updateCommitment: async (id: string, body: Record<string, unknown>) => {
      updateCalls.push({ id, body });
      return [];
    },
    recordXrplObservation: async (body: Record<string, unknown>) => {
      observations.push(body);
      return [];
    },
    latestXrplObservation: async () =>
      overrides.hasObservation === false
        ? null
        : {
            id: "obs-1",
            commitment_id: "row-1",
            transaction_hash:
              "55352D2661BF420D9AA962781AB66DC63E3916887ED362DEA9B6E63C3C960BF0",
            ledger_index: 19819259,
            validated: true,
            destination,
            delivered_amount_drops: "1000000",
            payment_reference: paymentReference,
            observed_at: "2026-01-01T00:00:00.000Z",
          },
    getOrCreateFdcJob: async (commitmentId: string, attestationType: string) => {
      const key = `${commitmentId}:${attestationType}`;
      const existing = jobsByKey.get(key);
      if (existing) return existing;
      const created = job(attestationType);
      jobsByKey.set(key, created);
      jobsById.set(created.id, created);
      return created;
    },
    updateFdcJob: async (id: string, body: Record<string, unknown>) => {
      const existing = jobsById.get(id);
      const updated = { ...existing, ...body } as FdcJobRecord;
      jobsById.set(id, updated);
      return [updated];
    },
    fdcJobById: async (id: string) => jobsById.get(id) ?? null,
  } as unknown as BackendRepository;
  const client = authClient();
  const app = buildApp({
    supabase: client,
    admin: client,
    backend: {
      repository,
      indexer: {} as CovenantIndexer,
      eventSource: {} as CovenantEventSource,
      internalApiSecret: "secret",
      xrplTransactionSource: {
        fetchTransaction: overrides.fetchTransaction ?? (async () => undefined),
      },
      fdcDeps: { ...noopFdcDeps(), ...overrides.fdcDeps },
    },
  });
  return { app, updateCalls, observations, jobsById, jobsByKey };
}

test("payment-request rejects a destination that does not match the committed hash", async () => {
  const { app } = buildPaymentTestApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/payment-request",
    payload: { xrplDestinationAddress: "rKQPLJHUD7x1sGu2hd37UutcZ64VbQGuZD" },
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

test("payment-request rejects a malformed destination address", async () => {
  const { app } = buildPaymentTestApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/payment-request",
    payload: { xrplDestinationAddress: "not-an-address" },
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

test("payment-request rejects a settled commitment", async () => {
  const { app } = buildPaymentTestApp({
    commitment: { ...row, status: "fulfilled" },
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/payment-request",
    payload: { xrplDestinationAddress: destination },
  });
  assert.equal(response.statusCode, 409);
  await app.close();
});

test("payment-request rejects an unknown commitment", async () => {
  const { app } = buildPaymentTestApp({ commitment: null });
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/payment-request",
    payload: { xrplDestinationAddress: destination },
  });
  assert.equal(response.statusCode, 404);
  await app.close();
});

test("payment-request builds the exact safe payload from authoritative commitment data and caches the validated address", async () => {
  const { app, updateCalls } = buildPaymentTestApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/payment-request",
    payload: { xrplDestinationAddress: destination },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body.transaction, {
    TransactionType: "Payment",
    Destination: destination,
    Amount: "1000000",
    Memos: [{ Memo: { MemoData: memoData } }],
  });
  assert.equal(body.xaman, null);
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0]?.body.recipient_xrpl_address, destination);
  await app.close();
});

test("payment-observation rejects a malformed transaction hash", async () => {
  const { app } = buildPaymentTestApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/payment-observation",
    payload: { transactionHash: "not-a-hash" },
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

test("payment-observation returns 404 when the transaction cannot be found", async () => {
  const { app } = buildPaymentTestApp({
    fetchTransaction: async () => undefined,
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/payment-observation",
    payload: { transactionHash: "F".repeat(64) },
  });
  assert.equal(response.statusCode, 404);
  await app.close();
});

test("payment-observation rejects a structurally invalid payment before any proof job could start", async () => {
  const { app, observations } = buildPaymentTestApp({
    fetchTransaction: async () => ({
      transaction: {
        TransactionType: "Payment",
        Destination: destination,
        Amount: "1000000",
        Memos: [],
      },
      meta: { TransactionResult: "tesSUCCESS", delivered_amount: "1000000" },
      validated: true,
      ledgerIndex: 123,
    }),
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/payment-observation",
    payload: { transactionHash: "F".repeat(64) },
  });
  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json().errors, ["missing memo"]);
  assert.equal(observations.length, 0);
  await app.close();
});

test("payment-observation accepts and persists a correctly referenced, fully paid, validated payment", async () => {
  const { app, observations } = buildPaymentTestApp({
    fetchTransaction: async () => ({
      transaction: {
        TransactionType: "Payment",
        Destination: destination,
        Amount: "1000000",
        Memos: [{ Memo: { MemoData: memoData } }],
      },
      meta: { TransactionResult: "tesSUCCESS", delivered_amount: "1000000" },
      validated: true,
      ledgerIndex: 123,
    }),
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/payment-observation",
    payload: { transactionHash: "F".repeat(64) },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.valid, true);
  assert.equal(body.deliveredAmountDrops, "1000000");
  assert.equal(observations.length, 1);
  assert.equal(observations[0]?.commitment_id, "row-1");
  await app.close();
});

test("prove-payment rejects a commitment with no validated XRPL observation yet", async () => {
  const { app } = buildPaymentTestApp({ hasObservation: false });
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/prove-payment",
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

test("prove-payment rejects a non-active commitment", async () => {
  const { app } = buildPaymentTestApp({ commitment: { ...row, status: "fulfilled" } });
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/prove-payment",
  });
  assert.equal(response.statusCode, 409);
  await app.close();
});

test("repeating prove-payment creates no conflicting job: both calls resolve the same job id", async () => {
  const { app, jobsByKey } = buildPaymentTestApp();
  const first = await app.inject({ method: "POST", url: "/api/commitments/7/prove-payment" });
  const second = await app.inject({ method: "POST", url: "/api/commitments/7/prove-payment" });
  assert.equal(first.statusCode, 202);
  assert.equal(second.statusCode, 202);
  assert.equal(first.json().id, second.json().id);
  assert.equal(jobsByKey.size, 1);
  await app.close();
});

test("prove-default rejects before the deadline and cure period have elapsed", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const { app } = buildPaymentTestApp({
    commitment: { ...row, cure_ends_at: future },
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/commitments/7/prove-default",
  });
  assert.equal(response.statusCode, 409);
  await app.close();
});

test("repeating prove-default after the cure period creates no conflicting job", async () => {
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const { app, jobsByKey } = buildPaymentTestApp({
    commitment: { ...row, cure_ends_at: past },
  });
  const first = await app.inject({ method: "POST", url: "/api/commitments/7/prove-default" });
  const second = await app.inject({ method: "POST", url: "/api/commitments/7/prove-default" });
  assert.equal(first.statusCode, 202);
  assert.equal(second.statusCode, 202);
  assert.equal(first.json().id, second.json().id);
  assert.equal(jobsByKey.size, 1);
  await app.close();
});

test("prove-payment and prove-default on the same commitment create two distinct, non-conflicting jobs", async () => {
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const { app, jobsByKey } = buildPaymentTestApp({
    commitment: { ...row, cure_ends_at: past },
  });
  await app.inject({ method: "POST", url: "/api/commitments/7/prove-payment" });
  await app.inject({ method: "POST", url: "/api/commitments/7/prove-default" });
  assert.equal(jobsByKey.size, 2);
  await app.close();
});

test("GET /api/fdc/jobs/:id returns 404 for an unknown job and 200 for a real one", async () => {
  const { app } = buildPaymentTestApp();
  const missing = await app.inject({
    url: `/api/fdc/jobs/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}`,
  });
  assert.equal(missing.statusCode, 404);
  const created = await app.inject({
    method: "POST",
    url: "/api/commitments/7/prove-payment",
  });
  const jobId = created.json().id;
  const status = await app.inject({ url: `/api/fdc/jobs/${jobId}` });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().id, jobId);
  await app.close();
});
