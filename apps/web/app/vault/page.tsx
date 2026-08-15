"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";

import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/spinner";
import { ConnectButton } from "@/components/wallet/connect-button";
import { CommitmentCard } from "@/components/vault/commitment-card";
import { listCommitments } from "@/lib/api";
import { COSTON2_CHAIN_ID, coston2 } from "@/lib/chains";
import type { CommitmentStatus } from "@/lib/commitment-types";
import { cx } from "@/lib/cx";

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
  const { address, isConnected, isReconnecting, chainId } = useAccount();

  useEffect(() => setMounted(true), []);

  const wrongNetwork = isConnected && chainId !== COSTON2_CHAIN_ID;
  const ready = mounted && !isReconnecting;
  const enabled = ready && isConnected && !wrongNetwork && Boolean(address);

  const query = useQuery({
    queryKey: ["commitments", address, status],
    queryFn: () => listCommitments({ wallet: address, status, limit: 100 }),
    enabled,
  });

  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">
        Vault
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Your commitments
        </h1>
        <Link
          href="/commitments/new"
          className={buttonClasses({ variant: "primary", size: "md" })}
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
          <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {statusFilters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                onClick={() => setStatus(filter.value)}
                aria-pressed={status === filter.value}
                className={cx(
                  "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150 ease-out-soft",
                  status === filter.value
                    ? "border-ink bg-ink text-paper"
                    : "border-line-strong bg-surface text-ink-soft hover:bg-surface-sunken",
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
                    Create a commitment
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
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
