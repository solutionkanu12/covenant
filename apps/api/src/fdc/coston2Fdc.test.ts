import assert from "node:assert/strict";
import test from "node:test";
import { ContractFunctionRevertedError, encodeErrorResult } from "viem";
import {
  restorePaymentProofData,
  restoreRpnProofData,
  commitmentNotActiveRevert,
  type PaymentProofData,
  type RpnProofData,
} from "./coston2Fdc.js";

const covenantEscrowErrorsAbi = [
  { type: "error", name: "CommitmentNotActive", inputs: [] },
  { type: "error", name: "ProofFieldMismatch", inputs: [] },
] as const;

function revertedError(errorName: "CommitmentNotActive" | "ProofFieldMismatch") {
  const data = encodeErrorResult({ abi: covenantEscrowErrorsAbi, errorName });
  return new ContractFunctionRevertedError({
    abi: covenantEscrowErrorsAbi,
    functionName: "settlePaid",
    data,
  });
}

const paymentProofData: PaymentProofData = {
  attestationType: `0x${"11".repeat(32)}`,
  sourceId: `0x${"22".repeat(32)}`,
  votingRound: 900123n,
  lowestUsedTimestamp: 1_700_000_000n,
  requestBody: {
    transactionId: `0x${"33".repeat(32)}`,
    inUtxo: 0n,
    utxo: 1n,
  },
  responseBody: {
    blockNumber: 19819259n,
    blockTimestamp: 1_700_000_100n,
    sourceAddressHash: `0x${"44".repeat(32)}`,
    sourceAddressesRoot: `0x${"00".repeat(32)}`,
    receivingAddressHash: `0x${"55".repeat(32)}`,
    intendedReceivingAddressHash: `0x${"55".repeat(32)}`,
    spentAmount: 1_000_000n,
    intendedSpentAmount: 1_000_000n,
    receivedAmount: 999_999n,
    intendedReceivedAmount: 1_000_000n,
    standardPaymentReference: `0x${"ab".repeat(32)}`,
    oneToOne: true,
    status: 0,
  },
};

const rpnProofData: RpnProofData = {
  attestationType: `0x${"11".repeat(32)}`,
  sourceId: `0x${"22".repeat(32)}`,
  votingRound: 900123n,
  lowestUsedTimestamp: 1_700_000_000n,
  requestBody: {
    minimalBlockNumber: 100n,
    deadlineBlockNumber: 200n,
    deadlineTimestamp: 1_700_000_500n,
    destinationAddressHash: `0x${"44".repeat(32)}`,
    amount: 999_999n,
    standardPaymentReference: `0x${"ab".repeat(32)}`,
    checkSourceAddresses: false,
    sourceAddressesRoot: `0x${"00".repeat(32)}`,
  },
  responseBody: {
    minimalBlockTimestamp: 1_700_000_050n,
    firstOverflowBlockNumber: 201n,
    firstOverflowBlockTimestamp: 1_700_000_600n,
  },
};

// Simulates a jsonb round-trip through Supabase: bigints serialize to decimal strings on write
// (via the client's bigint-safe replacer) and come back as plain strings on the next read.
function jsonRoundTrip<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

test("restorePaymentProofData converts every nested bigint field back from its persisted decimal string", () => {
  const roundTripped = jsonRoundTrip(paymentProofData);
  assert.equal(typeof roundTripped.votingRound, "string");
  const restored = restorePaymentProofData(roundTripped as unknown as PaymentProofData);
  assert.equal(restored.votingRound, paymentProofData.votingRound);
  assert.equal(restored.lowestUsedTimestamp, paymentProofData.lowestUsedTimestamp);
  assert.equal(restored.requestBody.inUtxo, paymentProofData.requestBody.inUtxo);
  assert.equal(restored.requestBody.utxo, paymentProofData.requestBody.utxo);
  assert.equal(restored.responseBody.blockNumber, paymentProofData.responseBody.blockNumber);
  assert.equal(
    restored.responseBody.blockTimestamp,
    paymentProofData.responseBody.blockTimestamp,
  );
  assert.equal(restored.responseBody.spentAmount, paymentProofData.responseBody.spentAmount);
  assert.equal(
    restored.responseBody.intendedSpentAmount,
    paymentProofData.responseBody.intendedSpentAmount,
  );
  assert.equal(
    restored.responseBody.receivedAmount,
    paymentProofData.responseBody.receivedAmount,
  );
  assert.equal(
    restored.responseBody.intendedReceivedAmount,
    paymentProofData.responseBody.intendedReceivedAmount,
  );
  for (const value of [
    restored.votingRound,
    restored.lowestUsedTimestamp,
    restored.requestBody.inUtxo,
    restored.requestBody.utxo,
    restored.responseBody.blockNumber,
    restored.responseBody.blockTimestamp,
    restored.responseBody.spentAmount,
    restored.responseBody.intendedSpentAmount,
    restored.responseBody.receivedAmount,
    restored.responseBody.intendedReceivedAmount,
  ])
    assert.equal(typeof value, "bigint");
  // Non-bigint fields are passed through untouched.
  assert.equal(restored.responseBody.oneToOne, true);
  assert.equal(restored.responseBody.status, 0);
  assert.equal(restored.requestBody.transactionId, paymentProofData.requestBody.transactionId);
});

test("restorePaymentProofData is idempotent when the data is already real bigints (no restart happened)", () => {
  const restored = restorePaymentProofData(paymentProofData);
  assert.deepEqual(restored, paymentProofData);
});

test("restoreRpnProofData converts every nested bigint field back from its persisted decimal string", () => {
  const roundTripped = jsonRoundTrip(rpnProofData);
  assert.equal(typeof roundTripped.requestBody.amount, "string");
  const restored = restoreRpnProofData(roundTripped as unknown as RpnProofData);
  assert.equal(restored.votingRound, rpnProofData.votingRound);
  assert.equal(restored.lowestUsedTimestamp, rpnProofData.lowestUsedTimestamp);
  assert.equal(restored.requestBody.minimalBlockNumber, rpnProofData.requestBody.minimalBlockNumber);
  assert.equal(restored.requestBody.deadlineBlockNumber, rpnProofData.requestBody.deadlineBlockNumber);
  assert.equal(restored.requestBody.deadlineTimestamp, rpnProofData.requestBody.deadlineTimestamp);
  assert.equal(restored.requestBody.amount, rpnProofData.requestBody.amount);
  assert.equal(
    restored.responseBody.minimalBlockTimestamp,
    rpnProofData.responseBody.minimalBlockTimestamp,
  );
  assert.equal(
    restored.responseBody.firstOverflowBlockNumber,
    rpnProofData.responseBody.firstOverflowBlockNumber,
  );
  assert.equal(
    restored.responseBody.firstOverflowBlockTimestamp,
    rpnProofData.responseBody.firstOverflowBlockTimestamp,
  );
  for (const value of [
    restored.votingRound,
    restored.lowestUsedTimestamp,
    restored.requestBody.minimalBlockNumber,
    restored.requestBody.deadlineBlockNumber,
    restored.requestBody.deadlineTimestamp,
    restored.requestBody.amount,
    restored.responseBody.minimalBlockTimestamp,
    restored.responseBody.firstOverflowBlockNumber,
    restored.responseBody.firstOverflowBlockTimestamp,
  ])
    assert.equal(typeof value, "bigint");
  assert.equal(restored.requestBody.checkSourceAddresses, false);
});

test("restoreRpnProofData is idempotent when the data is already real bigints (no restart happened)", () => {
  const restored = restoreRpnProofData(rpnProofData);
  assert.deepEqual(restored, rpnProofData);
});

test("commitmentNotActiveRevert recognizes a decoded CommitmentNotActive revert (selector 0x5ddf46a0)", () => {
  const error = revertedError("CommitmentNotActive");
  assert.equal(
    encodeErrorResult({ abi: covenantEscrowErrorsAbi, errorName: "CommitmentNotActive" }),
    "0x5ddf46a0",
  );
  assert.equal(commitmentNotActiveRevert(error), true);
});

test("commitmentNotActiveRevert rejects a different decoded custom error", () => {
  assert.equal(commitmentNotActiveRevert(revertedError("ProofFieldMismatch")), false);
});

test("commitmentNotActiveRevert rejects errors that aren't viem BaseErrors", () => {
  assert.equal(commitmentNotActiveRevert(new Error("EXECUTOR_KEY_MISSING")), false);
  assert.equal(commitmentNotActiveRevert("not an error"), false);
  assert.equal(commitmentNotActiveRevert(undefined), false);
});
