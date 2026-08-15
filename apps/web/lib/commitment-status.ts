import type { BadgeTone } from "@/components/ui/badge";
import type { CommitmentStatus, FdcJobStatus } from "./commitment-types";

export function commitmentStatusLabel(status: CommitmentStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "fulfilled":
      return "Fulfilled";
    case "defaulted":
      return "Defaulted";
  }
}

export function commitmentStatusTone(status: CommitmentStatus): BadgeTone {
  switch (status) {
    case "active":
      return "accent";
    case "fulfilled":
      return "success";
    case "defaulted":
      return "danger";
  }
}

export function isPastDeadline(deadlineAt: string, now = new Date()): boolean {
  return now.getTime() >= new Date(deadlineAt).getTime();
}

export function isPastCure(cureEndsAt: string, now = new Date()): boolean {
  return now.getTime() >= new Date(cureEndsAt).getTime();
}

const fdcJobStatusLabels: Record<FdcJobStatus, string> = {
  queued: "Queued",
  prepared: "Request prepared",
  submitted: "Request submitted to FDC",
  waiting_for_round: "Waiting for the FDC voting round",
  proof_ready: "Proof ready, submitting settlement",
  settlement_submitted: "Settlement submitted",
  settled: "Settled onchain",
  retryable_error: "Retrying",
  failed: "Failed",
};

export function fdcJobStatusLabel(status: FdcJobStatus): string {
  return fdcJobStatusLabels[status];
}

const fdcJobSteps: FdcJobStatus[] = [
  "queued",
  "prepared",
  "submitted",
  "waiting_for_round",
  "proof_ready",
  "settlement_submitted",
  "settled",
];

/** 0-based progress index for a step indicator; retryable_error keeps its last real step. */
export function fdcJobProgressIndex(status: FdcJobStatus): number {
  if (status === "failed") return -1;
  const index = fdcJobSteps.indexOf(status);
  return index === -1 ? fdcJobSteps.length - 1 : index;
}

export const fdcJobStepCount = fdcJobSteps.length;

/**
 * XRPL closes a ledger roughly every 3 to 5 seconds; close_time itself is rounded to the
 * nearest 10 seconds. To keep a real on-time payment from ever failing the contract's ledger
 * bound check, this estimate assumes a fast 3-second close and adds a fixed safety buffer, so
 * deadlineLedger is never lower than the ledger that will actually be closing at the deadline.
 */
const ASSUMED_SECONDS_PER_LEDGER = 3;
const DEADLINE_LEDGER_SAFETY_BUFFER = 60;

export function estimateDeadlineLedger(
  currentLedgerIndex: number,
  currentCloseTimeUnix: number,
  deadlineTimestampUnix: number,
): number {
  const secondsUntilDeadline = Math.max(
    0,
    deadlineTimestampUnix - currentCloseTimeUnix,
  );
  return (
    currentLedgerIndex +
    Math.ceil(secondsUntilDeadline / ASSUMED_SECONDS_PER_LEDGER) +
    DEADLINE_LEDGER_SAFETY_BUFFER
  );
}
