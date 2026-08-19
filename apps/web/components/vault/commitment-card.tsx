"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { getCommitment } from "@/lib/api";
import type { CommitmentRecord } from "@/lib/commitment-types";
import { commitmentStatusLabel, commitmentStatusTone } from "@/lib/commitment-status";
import { FXRP_DECIMALS, FXRP_SYMBOL, XRP_DECIMALS } from "@/lib/erc20";
import { formatTokenAmount, truncateHex } from "@/lib/format";

export function CommitmentCard({
  commitment,
  viewerAddress,
}: {
  commitment: CommitmentRecord;
  viewerAddress?: string;
}) {
  const queryClient = useQueryClient();
  const detailId = String(commitment.commitment_id);
  const prefetchDetail = () => {
    void queryClient.prefetchQuery({
      queryKey: ["commitment", detailId],
      queryFn: () => getCommitment(detailId),
    });
  };
  const isPayer =
    viewerAddress?.toLowerCase() === commitment.payer_flare_address.toLowerCase();
  const counterparty = isPayer
    ? commitment.recipient_flare_address
    : commitment.payer_flare_address;
  const role = isPayer ? "You are the payer" : "You are the recipient";
  const deadline = new Date(commitment.deadline_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={`/commitments/${detailId}`}
      prefetch
      onPointerEnter={prefetchDetail}
      onFocus={prefetchDetail}
      className="flex flex-col gap-3 p-5 transition-colors duration-150 ease-out-soft hover:bg-raised sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge tone={commitmentStatusTone(commitment.status)} dot>
            {commitmentStatusLabel(commitment.status)}
          </Badge>
          <span className="text-sm font-semibold text-ink">
            Commitment #{commitment.commitment_id}
          </span>
        </div>
        <p className="mt-1.5 truncate text-sm text-ink-soft">
          {role}, counterparty{" "}
          <span className="font-mono">{truncateHex(counterparty)}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1 text-sm sm:items-end">
        <span className="font-mono text-ink">
          {formatTokenAmount(BigInt(commitment.xrp_amount_drops), XRP_DECIMALS)} XRP
        </span>
        <span className="text-ink-soft">
          Bond{" "}
          {formatTokenAmount(BigInt(commitment.fxrp_bond_amount), FXRP_DECIMALS)}{" "}
          {FXRP_SYMBOL}
        </span>
        <span className="text-xs text-muted">Due {deadline}</span>
      </div>
    </Link>
  );
}
