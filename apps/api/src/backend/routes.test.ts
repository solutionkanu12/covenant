import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import type { CovenantIndexer } from "./indexer.js";
import type { BackendRepository, CommitmentRecord } from "./repository.js";
import type { CovenantEventSource } from "../chain/coston2.js";
import type { SupabaseHttpClient } from "../supabase/client.js";

const row = {
  id: "row-1",
  commitment_id: "7",
  status: "active",
  xrp_amount_drops: "100",
  fxrp_bond_amount: "200",
} as CommitmentRecord;

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
    backend: { repository, indexer, eventSource, internalApiSecret: "secret" },
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
