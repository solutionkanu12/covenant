"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/spinner";
import { ConnectButton } from "@/components/wallet/connect-button";
import { CreateForm } from "@/components/commitments/create-form";
import { COSTON2_CHAIN_ID, coston2 } from "@/lib/chains";

export default function NewCommitmentPage() {
  const [mounted, setMounted] = useState(false);
  const { isConnected, isReconnecting, chainId } = useAccount();

  useEffect(() => setMounted(true), []);

  const ready = mounted && !isReconnecting;
  const wrongNetwork = isConnected && chainId !== COSTON2_CHAIN_ID;

  return (
    <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">
        New commitment
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight break-words text-ink sm:text-4xl">
        Define the commitment
      </h1>
      <p className="mt-4 text-lg leading-8 text-pretty text-ink-soft">
        Lock an FXRP bond behind a future XRP payment. The bond returns to you when Flare
        verifies the payment, or moves to the recipient if the deadline passes unpaid.
      </p>

      <div className="mt-10">
        {!ready ? (
          <Skeleton className="h-96 w-full" />
        ) : !isConnected ? (
          <EmptyState
            title="Connect your wallet"
            description="Creating a commitment locks FXRP from your own wallet, so it needs to be connected first."
            action={<ConnectButton size="md" />}
          />
        ) : wrongNetwork ? (
          <EmptyState
            title="Switch to Coston2"
            description={`Covenant commitments live on ${coston2.name}. Switch networks to continue.`}
            action={<ConnectButton size="md" />}
          />
        ) : (
          <CreateForm />
        )}
      </div>
    </section>
  );
}
