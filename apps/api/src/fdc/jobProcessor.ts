import type { Address, Hex } from "viem";
import type {
  BackendRepository,
  CommitmentRecord,
  FdcJobRecord,
  FdcJobStatus,
} from "../backend/repository.js";
import type { PrepareRequestResult, RpnRequestBody } from "./verifierClient.js";

export type FdcExecutorDeps = {
  preparePayment(transactionId: Hex): Promise<PrepareRequestResult>;
  prepareRpn(body: RpnRequestBody): Promise<PrepareRequestResult>;
  submitRequest(
    abiEncodedRequest: Hex,
  ): Promise<{ requestTxHash: string; roundId: bigint }>;
  isRoundFinalized(roundId: bigint): Promise<boolean>;
  fetchProof(
    requestBytes: Hex,
    roundId: bigint,
  ): Promise<{ proof: Hex[]; responseHex: Hex }>;
  decodePaymentProof(responseHex: Hex): unknown;
  decodeRpnProof(responseHex: Hex): unknown;
  settlePaid(
    contractAddress: Address,
    commitmentId: bigint,
    merkleProof: readonly Hex[],
    data: unknown,
  ): Promise<string>;
  settleDefault(
    contractAddress: Address,
    commitmentId: bigint,
    merkleProof: readonly Hex[],
    data: unknown,
  ): Promise<string>;
};

export type JobRepository = Pick<
  BackendRepository,
  "updateFdcJob" | "latestXrplObservation" | "commitmentById"
>;

const maxAttempts = 8;
const zeroBytes32: Hex = `0x${"00".repeat(32)}`;

function toUnixSeconds(iso: string): string {
  return String(Math.floor(new Date(iso).getTime() / 1000));
}

async function persist(
  repository: JobRepository,
  job: FdcJobRecord,
  body: Record<string, unknown>,
): Promise<FdcJobRecord> {
  const rows = await repository.updateFdcJob(job.id, body);
  return (rows[0] as FdcJobRecord | undefined) ?? { ...job, ...body };
}

async function retryOrFail(
  repository: JobRepository,
  job: FdcJobRecord,
  step: FdcJobStatus,
  error: unknown,
): Promise<FdcJobRecord> {
  const message = error instanceof Error ? error.message : String(error);
  const isExecutorKeyMissing = message === "EXECUTOR_KEY_MISSING";
  const attemptCount = job.attempt_count + 1;
  const exhausted = !isExecutorKeyMissing && attemptCount >= maxAttempts;
  return persist(repository, job, {
    status: exhausted ? "failed" : "retryable_error",
    next_step: exhausted ? null : step,
    attempt_count: attemptCount,
    error_code: isExecutorKeyMissing ? "EXECUTOR_KEY_MISSING" : "STEP_FAILED",
    error_message: message,
  });
}

/**
 * Advances a persisted FDC job by exactly one step. Safe to call repeatedly: terminal states
 * (settled, failed) are a no-op, and a job crashed mid-step resumes from its persisted status
 * (or next_step, if it last failed) rather than restarting or duplicating a settlement.
 */
export async function advanceFdcJob(
  job: FdcJobRecord,
  commitment: CommitmentRecord,
  contractAddress: Address,
  deps: FdcExecutorDeps,
  repository: JobRepository,
): Promise<FdcJobRecord> {
  if (job.status === "settled" || job.status === "failed") return job;
  const step: FdcJobStatus =
    job.status === "retryable_error" && job.next_step ? job.next_step : job.status;

  try {
    switch (step) {
      case "queued": {
        let result: PrepareRequestResult;
        if (job.attestation_type === "payment") {
          const observation = await repository.latestXrplObservation(
            commitment.id,
          );
          if (!observation)
            return persist(repository, job, {
              status: "failed",
              error_code: "MISSING_OBSERVATION",
              error_message:
                "No validated XRPL payment observation exists for this commitment yet",
            });
          result = await deps.preparePayment(
            `0x${observation.transaction_hash}` as Hex,
          );
        } else {
          const body: RpnRequestBody = {
            minimalBlockNumber: String(commitment.minimal_ledger),
            deadlineBlockNumber: String(commitment.deadline_ledger),
            deadlineTimestamp: toUnixSeconds(commitment.deadline_at),
            destinationAddressHash: commitment.recipient_xrpl_address_hash as Hex,
            amount: (BigInt(commitment.xrp_amount_drops) - 1n).toString(),
            standardPaymentReference: commitment.payment_reference as Hex,
            checkSourceAddresses: false,
            sourceAddressesRoot: zeroBytes32,
          };
          result = await deps.prepareRpn(body);
        }
        if (!result.valid)
          return persist(repository, job, {
            status: "failed",
            error_code: "VERIFIER_INVALID",
            error_message: `Verifier rejected the request: ${result.status}`,
          });
        return persist(repository, job, {
          status: "prepared",
          request_bytes: result.abiEncodedRequest,
          next_step: null,
          attempt_count: 0,
          error_code: null,
          error_message: null,
        });
      }
      case "prepared": {
        const { requestTxHash, roundId } = await deps.submitRequest(
          job.request_bytes as Hex,
        );
        return persist(repository, job, {
          status: "submitted",
          request_tx_hash: requestTxHash,
          round_id: roundId.toString(),
          next_step: null,
          attempt_count: 0,
          error_code: null,
          error_message: null,
        });
      }
      case "submitted":
      case "waiting_for_round": {
        const finalized = await deps.isRoundFinalized(BigInt(job.round_id!));
        if (!finalized)
          return persist(repository, job, {
            status: "waiting_for_round",
            next_step: null,
            error_code: null,
            error_message: null,
          });
        const proof = await deps.fetchProof(
          job.request_bytes as Hex,
          BigInt(job.round_id!),
        );
        const decoded =
          job.attestation_type === "payment"
            ? deps.decodePaymentProof(proof.responseHex)
            : deps.decodeRpnProof(proof.responseHex);
        return persist(repository, job, {
          status: "proof_ready",
          proof_json: { merkleProof: proof.proof, data: decoded },
          next_step: null,
          attempt_count: 0,
          error_code: null,
          error_message: null,
        });
      }
      case "proof_ready": {
        try {
          const stored = job.proof_json as {
            merkleProof: Hex[];
            data: unknown;
          };
          const onchainId = BigInt(commitment.commitment_id);
          const hash =
            job.attestation_type === "payment"
              ? await deps.settlePaid(
                  contractAddress,
                  onchainId,
                  stored.merkleProof,
                  stored.data,
                )
              : await deps.settleDefault(
                  contractAddress,
                  onchainId,
                  stored.merkleProof,
                  stored.data,
                );
          return persist(repository, job, {
            status: "settled",
            settlement_tx_hash: hash,
            next_step: null,
            attempt_count: 0,
            error_code: null,
            error_message: null,
          });
        } catch (error) {
          // The contract already settled (this job's own earlier attempt landed but crashed
          // before persisting, another instance settled it, or a manual settlement occurred).
          // The commitment leaving "active" is authoritative: never re-submit, just record it.
          const fresh = await repository.commitmentById(commitment.id);
          if (fresh && fresh.status !== "active")
            return persist(repository, job, {
              status: "settled",
              next_step: null,
              error_code: null,
              error_message: null,
            });
          throw error;
        }
      }
      default:
        return job;
    }
  } catch (error) {
    return retryOrFail(repository, job, step, error);
  }
}
