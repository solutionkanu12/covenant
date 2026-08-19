import assert from "node:assert/strict";
import test from "node:test";
import { advanceFdcJob, type FdcExecutorDeps, type JobRepository } from "./jobProcessor.js";
import { restorePaymentProofData, type PaymentProofData } from "./coston2Fdc.js";
import type { CommitmentRecord, FdcJobRecord } from "../backend/repository.js";

const contractAddress = "0x841F714A57Ba1B1A77ef8b3732aCf825D593f017" as const;

function commitment(overrides: Partial<CommitmentRecord> = {}): CommitmentRecord {
  return {
    id: "commitment-uuid-1",
    owner_id: null,
    chain_id: 114,
    contract_address: contractAddress,
    commitment_id: "7",
    payer_flare_address: "0x0000000000000000000000000000000000000001",
    recipient_flare_address: "0x0000000000000000000000000000000000000002",
    recipient_xrpl_address: "rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw",
    recipient_xrpl_address_hash:
      "0x388d4bc2ff8a615fb4f77413d064d649189f618fe8dd9fc68d5d9de4b6c42893",
    xrp_amount_drops: "1000000",
    fxrp_bond_amount: "1000000",
    payment_reference: `0x${"ab".repeat(32)}`,
    start_xrpl_ledger: 100,
    minimal_ledger: 100,
    deadline_ledger: 200,
    deadline_at: "2026-01-01T00:00:00.000Z",
    cure_ends_at: "2026-01-08T00:00:00.000Z",
    status: "active",
    create_tx_hash: `0x${"9".repeat(64)}`,
    settlement_tx_hash: null,
    indexed_block_number: 1,
    indexed_log_index: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function job(overrides: Partial<FdcJobRecord> = {}): FdcJobRecord {
  return {
    id: "job-uuid-1",
    commitment_id: "commitment-uuid-1",
    attestation_type: "payment",
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
    ...overrides,
  };
}

function fakeRepository(overrides: Partial<JobRepository> = {}): {
  repository: JobRepository;
  updateCalls: Array<Record<string, unknown>>;
} {
  const updateCalls: Array<Record<string, unknown>> = [];
  const repository: JobRepository = {
    updateFdcJob: async (id, body) => {
      updateCalls.push(body);
      return [{ ...job(), id, ...body } as FdcJobRecord];
    },
    latestXrplObservation: async () => ({
      id: "obs-1",
      commitment_id: "commitment-uuid-1",
      transaction_hash: "55352D2661BF420D9AA962781AB66DC63E3916887ED362DEA9B6E63C3C960BF0",
      ledger_index: 19819259,
      validated: true,
      destination: "rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw",
      delivered_amount_drops: "1000000",
      payment_reference: `0x${"ab".repeat(32)}`,
      observed_at: "2026-01-01T00:00:00.000Z",
    }),
    commitmentById: async () => commitment(),
    ...overrides,
  };
  return { repository, updateCalls };
}

function fakeDeps(overrides: Partial<FdcExecutorDeps> = {}): {
  deps: FdcExecutorDeps;
  calls: Record<string, number>;
} {
  const calls: Record<string, number> = {};
  const count = (name: string) => (calls[name] = (calls[name] ?? 0) + 1);
  const deps: FdcExecutorDeps = {
    preparePayment: async () => {
      count("preparePayment");
      return { valid: true, abiEncodedRequest: "0xabcdef" };
    },
    prepareRpn: async () => {
      count("prepareRpn");
      return { valid: true, abiEncodedRequest: "0xabcdef" };
    },
    submitRequest: async () => {
      count("submitRequest");
      return { requestTxHash: "0xrequesthash", roundId: 42n };
    },
    isRoundFinalized: async () => {
      count("isRoundFinalized");
      return false;
    },
    fetchProof: async () => {
      count("fetchProof");
      return { proof: ["0xproofnode"], responseHex: "0xresponse" };
    },
    decodePaymentProof: () => {
      count("decodePaymentProof");
      return { decoded: true };
    },
    decodeRpnProof: () => {
      count("decodeRpnProof");
      return { decoded: true };
    },
    settlePaid: async () => {
      count("settlePaid");
      return "0xsettletxhash";
    },
    settleDefault: async () => {
      count("settleDefault");
      return "0xsettledefaulttxhash";
    },
    ...overrides,
  };
  return { deps, calls };
}

test("queued job with a valid observation prepares and advances to 'prepared'", async () => {
  const { repository } = fakeRepository();
  const { deps, calls } = fakeDeps();
  const result = await advanceFdcJob(
    job(),
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result.status, "prepared");
  assert.equal(result.request_bytes, "0xabcdef");
  assert.equal(calls.preparePayment, 1);
});

test("payment job with no observation yet fails immediately, non-retryable", async () => {
  const { repository } = fakeRepository({ latestXrplObservation: async () => null });
  const { deps } = fakeDeps();
  const result = await advanceFdcJob(
    job(),
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result.status, "failed");
  assert.equal(result.error_code, "MISSING_OBSERVATION");
});

test("verifier rejection fails the job without retrying", async () => {
  const { repository } = fakeRepository();
  const { deps } = fakeDeps({
    preparePayment: async () => ({ valid: false, status: "INVALID: INVALID BODY" }),
  });
  const result = await advanceFdcJob(
    job(),
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result.status, "failed");
  assert.equal(result.error_code, "VERIFIER_INVALID");
});

test("missing executor key on submit is retryable and resumes at 'prepared' without re-preparing", async () => {
  const { repository } = fakeRepository();
  const { deps, calls } = fakeDeps({
    submitRequest: async () => {
      throw new Error("EXECUTOR_KEY_MISSING");
    },
  });
  const prepared = job({ status: "prepared", request_bytes: "0xabcdef" });
  const result = await advanceFdcJob(
    prepared,
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result.status, "retryable_error");
  assert.equal(result.next_step, "prepared");
  assert.equal(result.error_code, "EXECUTOR_KEY_MISSING");
  assert.equal(calls.preparePayment, undefined);

  // Restart recovery: a fresh call against the persisted retryable_error row resumes the
  // same step (submit), not the beginning of the pipeline.
  const retrying = job({
    status: "retryable_error",
    next_step: "prepared",
    request_bytes: "0xabcdef",
    attempt_count: 1,
    error_code: "EXECUTOR_KEY_MISSING",
  });
  const { deps: recoveredDeps, calls: recoveredCalls } = fakeDeps();
  const resumed = await advanceFdcJob(
    retrying,
    commitment(),
    contractAddress,
    recoveredDeps,
    repository,
  );
  assert.equal(resumed.status, "submitted");
  assert.equal(recoveredCalls.preparePayment, undefined);
  assert.equal(recoveredCalls.submitRequest, 1);
});

test("a persistently failing non-key step escalates to 'failed' after the retry budget", async () => {
  const { repository } = fakeRepository();
  const { deps } = fakeDeps({
    submitRequest: async () => {
      throw new Error("network blip");
    },
  });
  let current = job({ status: "prepared", request_bytes: "0xabcdef" });
  for (let i = 0; i < 8; i += 1) {
    current = await advanceFdcJob(current, commitment(), contractAddress, deps, repository);
    if (current.status === "failed") break;
  }
  assert.equal(current.status, "failed");
});

test("waiting_for_round resumes and reaches proof_ready once finalized, without resubmitting", async () => {
  const { repository } = fakeRepository();
  const { deps, calls } = fakeDeps({ isRoundFinalized: async () => true });
  const waiting = job({
    status: "waiting_for_round",
    request_bytes: "0xabcdef",
    request_tx_hash: "0xrequesthash",
    round_id: "42",
  });
  const result = await advanceFdcJob(
    waiting,
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result.status, "proof_ready");
  assert.equal(calls.submitRequest, undefined);
  assert.equal(calls.fetchProof, 1);
  assert.deepEqual((result.proof_json as { merkleProof: string[] }).merkleProof, [
    "0xproofnode",
  ]);
});

test("proof_ready settles a payment job", async () => {
  const { repository } = fakeRepository();
  const { deps, calls } = fakeDeps();
  const ready = job({
    status: "proof_ready",
    proof_json: { merkleProof: ["0xproofnode"], data: { decoded: true } },
  });
  const result = await advanceFdcJob(
    ready,
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result.status, "settled");
  assert.equal(result.settlement_tx_hash, "0xsettletxhash");
  assert.equal(calls.settlePaid, 1);
  assert.equal(calls.settleDefault, undefined);
});

test("a job resumed after a restart carries proof_json bigint fields as persisted decimal strings, which the executor restores to real bigints before settling", async () => {
  const { repository } = fakeRepository();
  let capturedData: unknown;
  const { deps } = fakeDeps({
    // Mirrors what the real Coston2 executor does: restore bigint fields at the settlement
    // boundary, since jsonb round-trips bigints as decimal strings.
    settlePaid: async (_contractAddress, _commitmentId, _merkleProof, data) => {
      capturedData = restorePaymentProofData(data as PaymentProofData);
      return "0xsettletxhash";
    },
  });
  // Shape a proof_json exactly as it would come back from Supabase after a restart: every
  // bigint field decoded from the ABI response was serialized to a decimal string on write.
  const persistedAfterRestart = job({
    status: "proof_ready",
    proof_json: {
      merkleProof: ["0xproofnode"],
      data: {
        attestationType: `0x${"11".repeat(32)}`,
        sourceId: `0x${"22".repeat(32)}`,
        votingRound: "900123",
        lowestUsedTimestamp: "1700000000",
        requestBody: {
          transactionId: `0x${"33".repeat(32)}`,
          inUtxo: "0",
          utxo: "1",
        },
        responseBody: {
          blockNumber: "19819259",
          blockTimestamp: "1700000100",
          sourceAddressHash: `0x${"44".repeat(32)}`,
          sourceAddressesRoot: `0x${"00".repeat(32)}`,
          receivingAddressHash: `0x${"55".repeat(32)}`,
          intendedReceivingAddressHash: `0x${"55".repeat(32)}`,
          spentAmount: "1000000",
          intendedSpentAmount: "1000000",
          receivedAmount: "999999",
          intendedReceivedAmount: "1000000",
          standardPaymentReference: `0x${"ab".repeat(32)}`,
          oneToOne: true,
          status: 0,
        },
      },
    },
  });
  const result = await advanceFdcJob(
    persistedAfterRestart,
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result.status, "settled");
  const restored = capturedData as PaymentProofData;
  assert.equal(restored.votingRound, 900123n);
  assert.equal(typeof restored.votingRound, "bigint");
  assert.equal(restored.requestBody.utxo, 1n);
  assert.equal(restored.responseBody.spentAmount, 1_000_000n);
});

test("proof_ready settles a default (RPN) job via settleDefault", async () => {
  const { repository } = fakeRepository();
  const { deps, calls } = fakeDeps();
  const ready = job({
    attestation_type: "referenced_payment_nonexistence",
    status: "proof_ready",
    proof_json: { merkleProof: ["0xproofnode"], data: { decoded: true } },
  });
  const result = await advanceFdcJob(
    ready,
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result.status, "settled");
  assert.equal(calls.settleDefault, 1);
  assert.equal(calls.settlePaid, undefined);
});

test("settled and failed jobs are terminal no-ops (idempotent against repeated processing)", async () => {
  const { repository, updateCalls } = fakeRepository();
  const { deps, calls } = fakeDeps();
  const settled = job({ status: "settled", settlement_tx_hash: "0xdone" });
  const result = await advanceFdcJob(
    settled,
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result, settled);
  assert.equal(updateCalls.length, 0);
  assert.deepEqual(calls, {});
});

test("a settlement failure caused by an already-settled commitment is treated as settled, never re-thrown or re-submitted", async () => {
  const { repository } = fakeRepository({
    commitmentById: async () => commitment({ status: "fulfilled" }),
  });
  let settlePaidCalls = 0;
  const { deps } = fakeDeps({
    settlePaid: async () => {
      settlePaidCalls += 1;
      throw new Error("CommitmentNotActive");
    },
  });
  const ready = job({
    status: "proof_ready",
    proof_json: { merkleProof: ["0xproofnode"], data: { decoded: true } },
  });
  const result = await advanceFdcJob(
    ready,
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result.status, "settled");
  assert.equal(settlePaidCalls, 1);
});

test("a COMMITMENT_NOT_ACTIVE revert is treated as settled even when the commitments mirror in Supabase hasn't caught up yet (indexer lag)", async () => {
  let commitmentByIdCalls = 0;
  const { repository, updateCalls } = fakeRepository({
    // The indexer hasn't processed the CommitmentSettled event yet, so the mirror still says
    // active. The chain's own revert reason must be authoritative regardless, and checked first.
    commitmentById: async () => {
      commitmentByIdCalls += 1;
      return commitment({ status: "active" });
    },
  });
  let settlePaidCalls = 0;
  const { deps } = fakeDeps({
    settlePaid: async () => {
      settlePaidCalls += 1;
      throw new Error("COMMITMENT_NOT_ACTIVE");
    },
  });
  const ready = job({
    status: "proof_ready",
    proof_json: { merkleProof: ["0xproofnode"], data: { decoded: true } },
  });
  const result = await advanceFdcJob(
    ready,
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.equal(result.status, "settled");
  assert.equal(settlePaidCalls, 1);
  // Recovered without a Supabase round-trip and without touching attempt_count.
  assert.equal(commitmentByIdCalls, 0);
  assert.equal(updateCalls.length, 1);
  assert.equal("attempt_count" in updateCalls[0]!, false);
});

test("an RPN job derives amount as committed drops minus one and the exact ledger/reference fields", async () => {
  const { repository } = fakeRepository();
  let capturedBody: unknown;
  const { deps } = fakeDeps({
    prepareRpn: async (body) => {
      capturedBody = body;
      return { valid: true, abiEncodedRequest: "0xabcdef" };
    },
  });
  await advanceFdcJob(
    job({ attestation_type: "referenced_payment_nonexistence" }),
    commitment(),
    contractAddress,
    deps,
    repository,
  );
  assert.deepEqual(capturedBody, {
    minimalBlockNumber: "100",
    deadlineBlockNumber: "200",
    deadlineTimestamp: String(Math.floor(new Date("2026-01-01T00:00:00.000Z").getTime() / 1000)),
    destinationAddressHash:
      "0x388d4bc2ff8a615fb4f77413d064d649189f618fe8dd9fc68d5d9de4b6c42893",
    amount: "999999",
    standardPaymentReference: `0x${"ab".repeat(32)}`,
    checkSourceAddresses: false,
    sourceAddressesRoot: `0x${"00".repeat(32)}`,
  });
});
