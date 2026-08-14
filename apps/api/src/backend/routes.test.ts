import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import type { CovenantIndexer } from "./indexer.js";
import type { BackendRepository, CommitmentRecord } from "./repository.js";
import type { CovenantEventSource } from "../chain/coston2.js";
import type { SupabaseHttpClient } from "../supabase/client.js";
import type { XrplTransactionSource } from "../xrpl/client.js";

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
} = {}) {
  const commitment =
    overrides.commitment === undefined ? row : overrides.commitment;
  const updateCalls: Array<{ id: string; body: Record<string, unknown> }> = [];
  const observations: Array<Record<string, unknown>> = [];
  const repository = {
    commitment: async (_chain: number, _contract: string, id: string) =>
      id === "7" ? commitment : null,
    updateCommitment: async (id: string, body: Record<string, unknown>) => {
      updateCalls.push({ id, body });
      return [];
    },
    recordXrplObservation: async (body: Record<string, unknown>) => {
      observations.push(body);
      return [];
    },
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
    },
  });
  return { app, updateCalls, observations };
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
