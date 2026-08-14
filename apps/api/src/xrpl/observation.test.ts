import assert from "node:assert/strict";
import test from "node:test";
import { validateObservedPayment } from "./observation.js";

const destination = "rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw";
const destinationHash =
  "0x388d4bc2ff8a615fb4f77413d064d649189f618fe8dd9fc68d5d9de4b6c42893";
const reference = `0x${"ab".repeat(32)}`;
const memoData = "AB".repeat(32);

const expected = {
  destinationHash,
  amountDrops: 1_000_000n,
  paymentReference: reference,
};

function validPayment(overrides: Record<string, unknown> = {}) {
  return {
    TransactionType: "Payment",
    Destination: destination,
    Amount: "1000000",
    Memos: [{ Memo: { MemoData: memoData } }],
    ...overrides,
  };
}

const validMeta = {
  TransactionResult: "tesSUCCESS",
  delivered_amount: "1000000",
};

test("accepts a correctly referenced, fully paid, validated payment", () => {
  const result = validateObservedPayment(
    validPayment(),
    validMeta,
    true,
    expected,
  );
  assert.equal(result.valid, true);
});

test("rejects a missing memo", () => {
  const result = validateObservedPayment(
    validPayment({ Memos: [] }),
    validMeta,
    true,
    expected,
  );
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.errors.includes("missing memo"));
});

test("rejects duplicated memos", () => {
  const result = validateObservedPayment(
    validPayment({
      Memos: [{ Memo: { MemoData: memoData } }, { Memo: { MemoData: memoData } }],
    }),
    validMeta,
    true,
    expected,
  );
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.errors.includes("multiple memos"));
});

test("rejects an incorrect reference", () => {
  const result = validateObservedPayment(
    validPayment({ Memos: [{ Memo: { MemoData: "00".repeat(32) } }] }),
    validMeta,
    true,
    expected,
  );
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.errors.includes("incorrect reference"));
});

test("rejects an incorrect destination", () => {
  const result = validateObservedPayment(
    validPayment({ Destination: "rKQPLJHUD7x1sGu2hd37UutcZ64VbQGuZD" }),
    validMeta,
    true,
    expected,
  );
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.errors.includes("incorrect destination"));
});

test("rejects an underpaid delivered amount", () => {
  const result = validateObservedPayment(
    validPayment(),
    { ...validMeta, delivered_amount: "999999" },
    true,
    expected,
  );
  assert.equal(result.valid, false);
  assert.ok(
    !result.valid && result.errors.includes("incorrect or underpaid amount"),
  );
});

test("rejects an unsupported transaction type", () => {
  const result = validateObservedPayment(
    validPayment({ TransactionType: "OfferCreate" }),
    validMeta,
    true,
    expected,
  );
  assert.equal(result.valid, false);
  assert.ok(
    !result.valid && result.errors.includes("unsupported transaction type"),
  );
});

test("rejects a partial payment flag", () => {
  const result = validateObservedPayment(
    validPayment({ Flags: 0x00020000 }),
    validMeta,
    true,
    expected,
  );
  assert.equal(result.valid, false);
  assert.ok(
    !result.valid && result.errors.includes("malformed XRP payment payload"),
  );
});

test("rejects a cross-currency payment via SendMax/Paths", () => {
  const result = validateObservedPayment(
    validPayment({ SendMax: "1000000", Paths: [[]] }),
    validMeta,
    true,
    expected,
  );
  assert.equal(result.valid, false);
  assert.ok(
    !result.valid && result.errors.includes("malformed XRP payment payload"),
  );
});

test("rejects a transaction that is not yet validated", () => {
  const result = validateObservedPayment(
    validPayment(),
    validMeta,
    false,
    expected,
  );
  assert.equal(result.valid, false);
  assert.ok(
    !result.valid && result.errors.includes("transaction is not yet validated"),
  );
});
