"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { normalizeChainId } from "@/lib/wallet-status";

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
}

/**
 * The single source of truth for "what chain is the wallet actually on."
 *
 * wagmi's derived `chainId` (config.state.chainId, what `useChainId` reads)
 * only stays synced for chains present in `wagmiConfig.chains` — since we
 * only configure Coston2, a wallet sitting on any other chain can be
 * misreported there. This instead asks the connector's EIP-1193 provider
 * directly (`eth_chainId`, the same thing `connector.getChainId()` wraps)
 * and listens to the provider's own `chainChanged` event for live updates,
 * normalizing hex/decimal chain ids before returning them.
 */
export function useActualChainId(): number | undefined {
  const { isConnected, connector, chainId: wagmiChainId } = useAccount();
  const [actualChainId, setActualChainId] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!isConnected || !connector) {
      setActualChainId(undefined);
      return;
    }

    let cancelled = false;
    let provider: Eip1193Provider | undefined;

    function handleChainChanged(chainId: unknown) {
      const normalized = normalizeChainId(chainId);
      if (!cancelled && normalized !== undefined) {
        setActualChainId(normalized);
      }
    }

    connector
      .getChainId()
      .then((chainId) => {
        if (!cancelled) setActualChainId(chainId);
      })
      .catch(() => {});

    connector
      .getProvider()
      .then((rawProvider) => {
        if (cancelled) return;
        provider = rawProvider as Eip1193Provider;
        provider.on?.("chainChanged", handleChainChanged);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      provider?.removeListener?.("chainChanged", handleChainChanged);
    };
    // wagmiChainId is a trigger, not the value we trust: wagmi's own
    // change-tracking is a useful signal that something happened, so we
    // re-confirm against the provider directly whenever it moves.
  }, [isConnected, connector, wagmiChainId]);

  return isConnected ? actualChainId : undefined;
}
