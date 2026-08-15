"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { EvidenceList } from "@/components/commitments/evidence-list";
import { FdcPanel } from "@/components/commitments/fdc-panel";
import { PaymentPanel } from "@/components/commitments/payment-panel";
import { ApiError, getCommitment } from "@/lib/api";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/chains";
import { commitmentStatusLabel, commitmentStatusTone, isPastDeadline } from "@/lib/commitment-status";
import { FXRP_DECIMALS, FXRP_SYMBOL, XRP_DECIMALS } from "@/lib/erc20";
import { formatTokenAmount, truncateHex } from "@/lib/format";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

export default function CommitmentDetailPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <Skeleton className="h-10 w-64" />
        </section>
      }
    >
      <CommitmentDetail />
    </Suspense>
  );
}

function CommitmentDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const createdTxHash = searchParams.get("created");
  const { address } = useAccount();
  const { push } = useToast();
  const [copiedReference, setCopiedReference] = useState(false);

  const query = useQuery({
    queryKey: ["commitment", params.id],
    queryFn: () => getCommitment(params.id),
    retry: false,
    refetchInterval: (activeQuery) => {
      const error = activeQuery.state.error;
      const indexing = createdTxHash && error instanceof ApiError && error.status === 404;
      return indexing ? 3_000 : false;
    },
  });

  if (query.isPending) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <Skeleton className="h-10 w-64" />
        <div className="mt-8 space-y-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </section>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    if (notFound && createdTxHash) {
      return (
        <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
          <EmptyState
            title="Indexing your commitment"
            description="Your transaction confirmed on Coston2. Covenant is indexing it now; this page updates automatically."
            action={
              <a
                href={explorerTxUrl(createdTxHash)}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({ variant: "secondary", size: "md" })}
              >
                View the transaction
              </a>
            }
          />
        </section>
      );
    }
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
        <EmptyState
          tone="danger"
          title={notFound ? "Commitment not found" : "Could not load this commitment"}
          description={
            notFound
              ? "No indexed commitment matches this id."
              : query.error instanceof Error
                ? query.error.message
                : "Something went wrong talking to the Covenant API."
          }
          action={
            <Link href="/vault" className={buttonClasses({ variant: "secondary", size: "md" })}>
              Back to vault
            </Link>
          }
        />
      </section>
    );
  }

  const { commitment, evidence } = query.data;
  const isPayer = address?.toLowerCase() === commitment.payer_flare_address.toLowerCase();
  const isRecipient = address?.toLowerCase() === commitment.recipient_flare_address.toLowerCase();
  const deadlinePassed = isPastDeadline(commitment.deadline_at);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(commitment.payment_reference);
      setCopiedReference(true);
      window.setTimeout(() => setCopiedReference(false), 2000);
    } catch {
      push({ tone: "warning", title: "Copy failed", description: "Select the text and copy it manually." });
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={commitmentStatusTone(commitment.status)} dot>
          {commitmentStatusLabel(commitment.status)}
        </Badge>
        {commitment.status === "active" && deadlinePassed ? (
          <Badge tone="warning">Deadline passed</Badge>
        ) : null}
        {isPayer ? <Badge tone="neutral">You are the payer</Badge> : null}
        {isRecipient ? <Badge tone="neutral">You are the recipient</Badge> : null}
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Commitment #{commitment.commitment_id}
      </h1>

      <dl className="mt-8 rounded-2xl border border-line bg-surface px-6">
        <Row
          label="XRP amount"
          value={`${formatTokenAmount(BigInt(commitment.xrp_amount_drops), XRP_DECIMALS)} XRP`}
        />
        <Row
          label={`${FXRP_SYMBOL} bond`}
          value={`${formatTokenAmount(BigInt(commitment.fxrp_bond_amount), FXRP_DECIMALS)} ${FXRP_SYMBOL}`}
        />
        <Row
          label="Deadline"
          value={new Date(commitment.deadline_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        />
        <Row
          label="Payer"
          value={
            <a
              href={explorerAddressUrl(commitment.payer_flare_address)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-accent hover:text-accent-strong"
            >
              {truncateHex(commitment.payer_flare_address)}
            </a>
          }
        />
        <Row
          label="Recipient (Flare)"
          value={
            <a
              href={explorerAddressUrl(commitment.recipient_flare_address)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-accent hover:text-accent-strong"
            >
              {truncateHex(commitment.recipient_flare_address)}
            </a>
          }
        />
        <Row
          label="Recipient (XRPL)"
          value={
            commitment.recipient_xrpl_address ? (
              <a
                href={`https://testnet.xrpl.org/accounts/${commitment.recipient_xrpl_address}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-accent hover:text-accent-strong"
              >
                {commitment.recipient_xrpl_address}
              </a>
            ) : (
              <span className="text-muted">Not yet confirmed</span>
            )
          }
        />
        <Row
          label="Payment reference"
          value={
            <button
              type="button"
              onClick={() => void copyReference()}
              className="font-mono text-ink-soft hover:text-ink"
              title={commitment.payment_reference}
            >
              {copiedReference ? "Copied" : truncateHex(commitment.payment_reference)}
            </button>
          }
        />
        <Row
          label="Created"
          value={
            <a
              href={explorerTxUrl(commitment.create_tx_hash)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-accent hover:text-accent-strong"
            >
              {truncateHex(commitment.create_tx_hash)}
            </a>
          }
        />
      </dl>

      {commitment.status === "active" ? (
        <div className="mt-6">
          <PaymentPanel commitment={commitment} />
        </div>
      ) : null}

      <div className="mt-6">
        <FdcPanel commitment={commitment} />
      </div>

      <div className="mt-6">
        <EvidenceList evidence={evidence} />
      </div>
    </section>
  );
}
