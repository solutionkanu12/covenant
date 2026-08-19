"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";

import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/spinner";
import { ConnectButton } from "@/components/wallet/connect-button";
import { useActualChainId } from "@/components/wallet/use-actual-chain-id";
import { CommitmentCard } from "@/components/vault/commitment-card";
import { listCommitments } from "@/lib/api";
import { coston2 } from "@/lib/chains";
import type { CommitmentStatus } from "@/lib/commitment-types";
import { cx } from "@/lib/cx";
import { FXRP_DECIMALS, FXRP_SYMBOL, XRP_DECIMALS } from "@/lib/erc20";
import { formatTokenAmount } from "@/lib/format";
import { isWrongNetwork } from "@/lib/wallet-status";

const statusFilters: { label: string; value: CommitmentStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Active", value: "active" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Defaulted", value: "defaulted" },
];

function ListSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export default function VaultPage() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<CommitmentStatus | undefined>(undefined);
  const { address, isConnected, isReconnecting } = useAccount();
  const chainId = useActualChainId();

  useEffect(() => setMounted(true), []);

  const wrongNetwork = isWrongNetwork(isConnected, chainId);
  const ready = mounted && !isReconnecting;
  const enabled = ready && isConnected && !wrongNetwork && Boolean(address);

  const query = useQuery({
    queryKey: ["commitments", address, status],
    queryFn: () => listCommitments({ wallet: address, status, limit: 100 }),
    enabled,
  });

  const totals = useMemo(() => {
    if (!query.data || query.data.length === 0) return null;
    return {
      count: query.data.length,
      xrp: query.data.reduce(
        (sum, row) => sum + BigInt(row.xrp_amount_drops),
        0n,
      ),
      bond: query.data.reduce(
        (sum, row) => sum + BigInt(row.fxrp_bond_amount),
        0n,
      ),
    };
  }, [query.data]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">
            Vault
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight break-words text-ink sm:text-4xl">
            Your commitments
          </h1>
        </div>
        <Link
          href="/commitments/new"
          className={buttonClasses({
            variant: "primary",
            size: "md",
            className: "w-full sm:w-auto",
          })}
        >
          New commitment
        </Link>
      </div>

      {!ready ? (
        <div className="mt-10">
          <ListSkeleton />
        </div>
      ) : !isConnected ? (
        <div className="mt-10">
          <EmptyState
            title="Connect your wallet"
            description="Your vault shows every commitment where your wallet is the payer or the recipient."
            action={<ConnectButton size="md" />}
          />
        </div>
      ) : wrongNetwork ? (
        <div className="mt-10">
          <EmptyState
            title="Switch to Coston2"
            description={`Covenant reads commitments from ${coston2.name}. Switch networks to see your vault.`}
            action={<ConnectButton size="md" />}
          />
        </div>
      ) : (
        <>
          {totals ? (
            <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-surface px-4 py-4">
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Shown
                </dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  {totals.count}
                </dd>
              </div>
              <div className="rounded-lg border border-line bg-surface px-4 py-4">
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
                  XRP promised
                </dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink">
                  {formatTokenAmount(totals.xrp, XRP_DECIMALS)}
                </dd>
              </div>
              <div className="rounded-lg border border-line bg-surface px-4 py-4">
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {FXRP_SYMBOL} bonded
                </dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink">
                  {formatTokenAmount(totals.bond, FXRP_DECIMALS)}
                </dd>
              </div>
            </dl>
          ) : null}

          <div
            className="mt-8 flex flex-wrap gap-2"
            role="group"
            aria-label="Filter by status"
          >
            {statusFilters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                onClick={() => setStatus(filter.value)}
                aria-pressed={status === filter.value}
                className={cx(
                  "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-[transform,color,background-color,border-color] duration-[160ms] ease-out-soft hover:scale-[0.96] motion-reduce:hover:scale-100",
                  status === filter.value
                    ? "border-accent bg-accent text-ink"
                    : "border-line-strong bg-surface text-ink-soft hover:bg-raised",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {query.isPending ? (
              <ListSkeleton />
            ) : query.isError ? (
              <EmptyState
                tone="danger"
                title="Could not load your vault"
                description={
                  query.error instanceof Error
                    ? query.error.message
                    : "Something went wrong talking to the Covenant API."
                }
                action={
                  <Button variant="secondary" onClick={() => query.refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : query.data.length === 0 ? (
              <EmptyState
                title="No commitments yet"
                description="Commitments where your wallet is the payer or recipient will appear here once they are indexed."
                action={
                  <Link
                    href="/commitments/new"
                    className={buttonClasses({ variant: "primary", size: "md" })}
                  >
                    New commitment
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {query.data.map((commitment) => (
                  <CommitmentCard
                    key={commitment.id}
                    commitment={commitment}
                    viewerAddress={address}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
