"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

import { shouldRedirectToLanding } from "@/lib/wallet-status";

/**
 * Mounted only on wallet-gated routes (/vault, /commitments/*). Sends the
 * visitor back to `/` once we're sure the wallet is genuinely disconnected
 * (not mid-reconnect), so a page load never bounces a wallet that's about
 * to restore. Wrong network is a different state and is left alone here —
 * that's reflected in place by the page/ConnectButton, not routed away.
 */
export function DashboardGuard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { isConnected, isReconnecting } = useAccount();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (shouldRedirectToLanding(mounted, isReconnecting, isConnected)) {
      router.replace("/");
    }
  }, [mounted, isReconnecting, isConnected, router]);

  return null;
}
