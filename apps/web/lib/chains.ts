import { flareTestnet } from "viem/chains";

/** Flare Coston2 testnet (chain id 114), the only network Covenant uses. */
export const coston2 = flareTestnet;
export const COSTON2_CHAIN_ID = coston2.id;

export const coston2ExplorerUrl: string =
  coston2.blockExplorers.default.url.replace(/\/$/, "");

export function explorerAddressUrl(address: string): string {
  return `${coston2ExplorerUrl}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${coston2ExplorerUrl}/tx/${hash}`;
}
