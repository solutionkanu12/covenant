import assert from "node:assert/strict";
import test from "node:test";
import {
  matchesCommittedDestination,
  paymentReferenceToMemoData,
  xrplAddressHash,
} from "./reference.js";

const address = "rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw";
const hash =
  "0x388d4bc2ff8a615fb4f77413d064d649189f618fe8dd9fc68d5d9de4b6c42893";

test("xrplAddressHash matches Flare's proven standard address hash", () => {
  assert.equal(xrplAddressHash(address), hash);
});

test("matchesCommittedDestination accepts only the exact committed address", () => {
  assert.equal(matchesCommittedDestination(address, hash), true);
  assert.equal(
    matchesCommittedDestination("rKQPLJHUD7x1sGu2hd37UutcZ64VbQGuZD", hash),
    false,
  );
  assert.equal(matchesCommittedDestination("not-an-address", hash), false);
});

test("paymentReferenceToMemoData strips 0x and uppercases", () => {
  const reference = `0x${"ab".repeat(32)}`;
  assert.equal(paymentReferenceToMemoData(reference), "AB".repeat(32));
});

test("paymentReferenceToMemoData rejects non-32-byte references", () => {
  assert.throws(() => paymentReferenceToMemoData("0xabcd"));
});
