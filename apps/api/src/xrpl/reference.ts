import { isValidClassicAddress } from "xrpl";
import { keccak256, toBytes, type Hex } from "viem";

/**
 * Flare's standard XRPL address hash: keccak256 of the UTF-8 bytes of the classic ('r...')
 * address string. This is the exact scheme FDC uses for receivingAddressHash /
 * destinationAddressHash and what CovenantEscrow stores as xrplDestinationHash.
 */
export function xrplAddressHash(classicAddress: string): Hex {
  return keccak256(toBytes(classicAddress));
}

export function isValidXrplDestination(address: string): boolean {
  return isValidClassicAddress(address);
}

export function matchesCommittedDestination(
  candidateAddress: string,
  committedHash: string,
): boolean {
  return (
    isValidXrplDestination(candidateAddress) &&
    xrplAddressHash(candidateAddress).toLowerCase() ===
      committedHash.toLowerCase()
  );
}

/** XRPL MemoData is uppercase hex with no 0x prefix. The onchain reference is already 32 bytes. */
export function paymentReferenceToMemoData(paymentReference: string): string {
  const hex = paymentReference.startsWith("0x")
    ? paymentReference.slice(2)
    : paymentReference;
  if (!/^[0-9a-fA-F]{64}$/.test(hex))
    throw new Error("Payment reference must be exactly 32 bytes");
  return hex.toUpperCase();
}
