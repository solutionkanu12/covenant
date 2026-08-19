import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseHttpClient } from "./client.js";
import type { SupabaseConfig } from "../config.js";

const config: SupabaseConfig = {
  url: "https://example.supabase.co",
  publishableKey: "publishable-key",
  serviceRoleKey: "service-role-key",
};

function withStubbedFetch<T>(
  respond: (body: string) => unknown,
  run: () => Promise<T>,
): Promise<{ result: T; capturedBody: string }> {
  const originalFetch = globalThis.fetch;
  let capturedBody = "";
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    capturedBody = String(init?.body ?? "");
    return new Response(JSON.stringify(respond(capturedBody)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return run()
    .then((result) => ({ result, capturedBody }))
    .finally(() => {
      globalThis.fetch = originalFetch;
    });
}

test("update() serializes nested bigints as decimal strings instead of throwing", async () => {
  const client = new SupabaseHttpClient(config, config.serviceRoleKey);
  const body = {
    status: "proof_ready",
    proof_json: {
      merkleProof: ["0xproofnode"],
      data: {
        attestationType: "0xaa",
        votingRound: 42n,
        requestBody: { inUtxo: 0n, utxo: 1n },
        responseBody: {
          blockNumber: 123456789012345678901234567890n,
          spentAmount: -5n,
          oneToOne: true,
          status: 0,
        },
      },
    },
  };
  const { capturedBody } = await withStubbedFetch(
    () => [{ id: "job-1", status: "proof_ready" }],
    () => client.from("fdc_jobs").update("id=eq.job-1", body),
  );
  const parsed = JSON.parse(capturedBody);
  assert.equal(parsed.proof_json.data.votingRound, "42");
  assert.equal(parsed.proof_json.data.requestBody.inUtxo, "0");
  assert.equal(parsed.proof_json.data.requestBody.utxo, "1");
  assert.equal(
    parsed.proof_json.data.responseBody.blockNumber,
    "123456789012345678901234567890",
  );
  assert.equal(parsed.proof_json.data.responseBody.spentAmount, "-5");
  // Non-bigint values are preserved as their original JSON types, not coerced to strings.
  assert.equal(parsed.proof_json.data.responseBody.oneToOne, true);
  assert.equal(parsed.proof_json.data.responseBody.status, 0);
  assert.deepEqual(parsed.proof_json.merkleProof, ["0xproofnode"]);
  assert.equal(parsed.status, "proof_ready");
});

test("update() body with no bigints round-trips unchanged", async () => {
  const client = new SupabaseHttpClient(config, config.serviceRoleKey);
  const body = { status: "settled", settlement_tx_hash: "0xdeadbeef", attempt_count: 0 };
  const { capturedBody } = await withStubbedFetch(
    () => [{ id: "job-1", ...body }],
    () => client.from("fdc_jobs").update("id=eq.job-1", body),
  );
  assert.deepEqual(JSON.parse(capturedBody), body);
});
