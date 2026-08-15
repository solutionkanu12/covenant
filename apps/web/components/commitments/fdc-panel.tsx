"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFdcJob, proveDefault, provePayment } from "@/lib/api";
import { cx } from "@/lib/cx";
import {
  fdcJobProgressIndex,
  fdcJobStatusLabel,
  fdcJobStepCount,
  isPastCure,
} from "@/lib/commitment-status";
import type { CommitmentRecord, FdcJobStatus } from "@/lib/commitment-types";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/chains";

function JobProgress({ status }: { status: FdcJobStatus }) {
  const index = fdcJobProgressIndex(status);
  const failed = status === "failed";
  return (
    <div>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: fdcJobStepCount }).map((_, step) => (
          <span
            key={step}
            className={cx(
              "h-1.5 flex-1 rounded-full",
              !failed && step <= index ? "bg-accent" : "bg-line-strong",
            )}
          />
        ))}
      </div>
      <p className={cx("mt-2 text-sm font-semibold", failed ? "text-danger" : "text-ink")}>
        {fdcJobStatusLabel(status)}
      </p>
    </div>
  );
}

export function FdcPanel({ commitment }: { commitment: CommitmentRecord }) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ["fdc-job", jobId],
    queryFn: () => getFdcJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "settled" || status === "failed" ? false : 5_000;
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () => provePayment(commitment.commitment_id),
    onSuccess: (job) => setJobId(job.id),
  });
  const defaultMutation = useMutation({
    mutationFn: () => proveDefault(commitment.commitment_id),
    onSuccess: (job) => setJobId(job.id),
  });

  const settled = jobQuery.data?.status === "settled";
  useEffect(() => {
    if (settled)
      void queryClient.invalidateQueries({
        queryKey: ["commitment", commitment.commitment_id],
      });
  }, [settled, queryClient, commitment.commitment_id]);

  if (commitment.status !== "active") {
    const fulfilled = commitment.status === "fulfilled";
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Settlement</h2>
        <div className="mt-4 flex items-center gap-3">
          <Badge tone={fulfilled ? "success" : "danger"} dot>
            {fulfilled ? "Fulfilled" : "Defaulted"}
          </Badge>
          <p className="text-sm text-ink-soft">
            {fulfilled
              ? "The FXRP bond returned to the payer."
              : "The FXRP bond moved to the recipient."}
          </p>
        </div>
        {commitment.settlement_tx_hash ? (
          <a
            href={explorerTxUrl(commitment.settlement_tx_hash)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-accent hover:text-accent-strong"
          >
            View the settlement transaction
          </a>
        ) : null}
      </div>
    );
  }

  const cureElapsed = isPastCure(commitment.cure_ends_at);
  const startError = paymentMutation.error ?? defaultMutation.error;

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold tracking-tight text-ink">Settlement proof</h2>
      <p className="mt-1.5 text-sm leading-6 text-ink-soft">
        Settlement is permissionless: anyone can request the Flare proof once the evidence
        exists. The contract, not the requester, decides who receives the bond.
      </p>

      {jobId && jobQuery.data ? (
        <div className="mt-5 flex flex-col gap-3">
          <JobProgress status={jobQuery.data.status} />
          {jobQuery.data.status === "failed" && jobQuery.data.error_message ? (
            <p role="alert" className="text-sm text-danger">
              {jobQuery.data.error_message}
            </p>
          ) : null}
          {jobQuery.data.status === "retryable_error" ? (
            <p className="text-sm text-ink-soft">
              A step failed and is retrying automatically. This page updates on its own.
            </p>
          ) : null}
          {jobQuery.data.settlement_tx_hash ? (
            <a
              href={explorerTxUrl(jobQuery.data.settlement_tx_hash)}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-accent hover:text-accent-strong"
            >
              View the settlement transaction
            </a>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            loading={paymentMutation.isPending}
            loadingLabel="Starting"
            onClick={() => paymentMutation.mutate()}
          >
            Start payment proof
          </Button>
          <Button
            variant="secondary"
            loading={defaultMutation.isPending}
            loadingLabel="Starting"
            disabled={!cureElapsed}
            onClick={() => defaultMutation.mutate()}
          >
            Start default proof
          </Button>
        </div>
      )}

      {!cureElapsed && !jobId ? (
        <p className="mt-3 text-sm text-muted">
          Default verification becomes available once the deadline has passed.
        </p>
      ) : null}
      {startError && !jobId ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {startError instanceof Error ? startError.message : "Could not start the proof."}
        </p>
      ) : null}

      <a
        href={explorerAddressUrl(commitment.contract_address)}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-block text-sm text-muted hover:text-ink"
      >
        View the escrow contract on the Coston2 explorer
      </a>
    </div>
  );
}
