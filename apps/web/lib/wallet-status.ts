import { COSTON2_CHAIN_ID } from "./chains";

/**
 * Normalizes a chain id reported by an EIP-1193 provider (hex string like
 * `"0x72"`, a decimal string, a number, or a bigint) to a plain decimal
 * number, so every comparison against `COSTON2_CHAIN_ID` is apples-to-apples
 * regardless of how a given wallet reports it.
 */
export function normalizeChainId(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    const parsed = trimmed.startsWith("0x")
      ? Number.parseInt(trimmed, 16)
      : Number(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/** Connected is not the same as usable: the chain must match too. */
export function isWrongNetwork(
  isConnected: boolean,
  chainId: number | undefined,
): boolean {
  return isConnected && chainId !== COSTON2_CHAIN_ID;
}

export function shouldRedirectToVault(
  isConnected: boolean,
  chainId: number | undefined,
): boolean {
  return isConnected && chainId === COSTON2_CHAIN_ID;
}

/** Only fires once reconnect has had its chance, so a page load never bounces a wallet that's about to restore. */
export function shouldRedirectToLanding(
  mounted: boolean,
  isReconnecting: boolean,
  isConnected: boolean,
): boolean {
  return mounted && !isReconnecting && !isConnected;
}

/** The subset of the dashboard shell that actually requires a connected wallet (unlike /how-it-works or /deployment, which are public). */
export function isWalletGatedPath(pathname: string): boolean {
  return pathname === "/vault" || pathname.startsWith("/commitments");
}
