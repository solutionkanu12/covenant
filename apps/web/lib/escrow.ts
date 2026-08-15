import { covenantEscrowCreateAbi } from "@covenant/shared";
import { decodeEventLog, type Hex, type Log } from "viem";

export type CommitmentCreatedArgs = {
  commitmentId: bigint;
  payer: `0x${string}`;
  beneficiary: `0x${string}`;
  paymentReference: Hex;
};

/**
 * Reads the CommitmentCreated event out of a createCommitment transaction receipt. The receipt
 * is the only trustworthy source for the assigned commitmentId: the contract derives it from
 * onchain storage, so nothing in the browser ever guesses or hard-codes it.
 */
export function decodeCommitmentCreated(
  logs: readonly Log[],
  escrowAddress: `0x${string}`,
): CommitmentCreatedArgs | null {
  for (const log of logs) {
    if (log.address.toLowerCase() !== escrowAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: covenantEscrowCreateAbi,
        eventName: "CommitmentCreated",
        data: log.data,
        topics: log.topics,
      });
      return decoded.args as unknown as CommitmentCreatedArgs;
    } catch {
      continue;
    }
  }
  return null;
}
