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

/** Turns a wagmi/viem contract error into a short, plain-language message. */
export function friendlyContractError(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  if (name.includes("UserRejectedRequestError") || /user rejected/i.test(message))
    return "The request was cancelled in the wallet.";
  if (/insufficient funds/i.test(message))
    return "The wallet does not have enough C2FLR for gas or enough FXRP for the bond.";
  if (/DeadlineNotFuture/.test(message))
    return "The payment deadline has already passed. Choose a later time.";
  if (/ZeroAmount/.test(message))
    return "The XRP amount and FXRP bond must both be greater than zero.";
  if (/ZeroAddress/.test(message))
    return "Check the recipient address and try again.";
  return "The transaction could not be completed. Check the wallet for details and try again.";
}
