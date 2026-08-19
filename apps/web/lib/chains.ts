import { defineChain } from "viem";

// Defined directly (rather than imported from the `viem/chains` barrel) so
// this module doesn't pull in every other chain definition in that barrel,
// including one with a dynamic `require` that webpack can't statically
// analyze and that measurably slows dev compilation of every route that
// touches the wallet. Values match viem's own `flareTestnet` definition.
/** Flare Coston2 testnet (chain id 114), the only network Covenant uses. */
export const coston2 = /*#__PURE__*/ defineChain({
  id: 114,
  name: "Flare Testnet Coston2",
  nativeCurrency: {
    decimals: 18,
    name: "Coston2 Flare",
    symbol: "C2FLR",
  },
  rpcUrls: {
    default: { http: ["https://coston2-api.flare.network/ext/C/rpc"] },
  },
  blockExplorers: {
    default: {
      name: "Coston2 Explorer",
      url: "https://coston2-explorer.flare.network",
      apiUrl: "https://coston2-explorer.flare.network/api",
    },
  },
  testnet: true,
});
export const COSTON2_CHAIN_ID = coston2.id;

export const coston2ExplorerUrl: string =
  coston2.blockExplorers.default.url.replace(/\/$/, "");

export function explorerAddressUrl(address: string): string {
  return `${coston2ExplorerUrl}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${coston2ExplorerUrl}/tx/${hash}`;
}
