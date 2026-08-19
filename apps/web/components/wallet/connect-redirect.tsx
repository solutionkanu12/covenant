"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

import { shouldRedirectToVault } from "@/lib/wallet-status";
import { useActualChainId } from "./use-actual-chain-id";

/**
 * Landing-page-only: sends the visitor to the vault once the wallet's
 * *actual* provider-confirmed chain is Coston2 — never on wagmi's assumed
 * state alone. Scoped to `/` (rather than mounted app-wide) so it fires on
 * the connect transition without hijacking deep links into other dashboard
 * routes, and unmounts on navigation so it can't loop.
 */
export function ConnectRedirect() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const chainId = useActualChainId();

  // Warm the /vault route as soon as the landing page is up, so the
  // post-connect redirect below doesn't wait on a first compile/RSC fetch.
  useEffect(() => {
    router.prefetch("/vault");
  }, [router]);

  useEffect(() => {
    if (shouldRedirectToVault(isConnected, chainId)) {
      router.replace("/vault");
    }
  }, [isConnected, chainId, router]);

  return null;
}
