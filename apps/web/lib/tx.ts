import { explorerTxUrl } from "./chains";

/** Shared lifecycle for any onchain transaction the UI tracks. */
export type TxStatus = "idle" | "signing" | "pending" | "confirmed" | "failed";

export type TxState = {
  status: TxStatus;
  hash?: `0x${string}`;
  errorMessage?: string;
};

export const idleTxState: TxState = { status: "idle" };

export function txStatusLabel(status: TxStatus): string {
  switch (status) {
    case "signing":
      return "Waiting for signature";
    case "pending":
      return "Confirming on Coston2";
    case "confirmed":
      return "Confirmed";
    case "failed":
      return "Failed";
    default:
      return "Ready";
  }
}

export function txExplorerLink(hash: `0x${string}`): string {
  return explorerTxUrl(hash);
}
