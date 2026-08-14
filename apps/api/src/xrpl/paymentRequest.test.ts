import assert from "node:assert/strict";
import test from "node:test";
import { buildXrplPaymentPayload } from "./paymentRequest.js";

test("builds a direct payment with exactly one memo and drops as a decimal string", () => {
  const payload = buildXrplPaymentPayload({
    destination: "rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw",
    amountDrops: "1000000",
    paymentReference: `0x${"ab".repeat(32)}`,
  });
  assert.deepEqual(payload, {
    TransactionType: "Payment",
    Destination: "rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw",
    Amount: "1000000",
    Memos: [{ Memo: { MemoData: "AB".repeat(32) } }],
  });
});
