import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { createPaymentRequest, proveDefault, provePayment } from "./api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function captureFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

test("proveDefault and provePayment do not send an empty JSON content-type", async () => {
  const calls = captureFetch(202, { id: "job-1" });
  await proveDefault("1");
  await provePayment("1");
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const headers = new Headers(call.init?.headers);
    assert.equal(headers.has("content-type"), false);
    assert.equal(call.init?.body, undefined);
  }
});

test("createPaymentRequest still sends a JSON body and content-type", async () => {
  const calls = captureFetch(200, { commitmentId: "1" });
  await createPaymentRequest("1", "rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw");
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({
      xrplDestinationAddress: "rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw",
    }),
  );
});
