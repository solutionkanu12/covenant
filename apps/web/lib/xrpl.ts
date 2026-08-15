import { keccak256, toBytes, type Hex } from "viem";
import { isValidClassicAddress } from "xrpl";

/** Matches the checksum validation the Covenant API performs on the same field. */
export function isValidXrplAddress(address: string): boolean {
  return isValidClassicAddress(address.trim());
}

/**
 * Flare's standard XRPL address hash: keccak256 of the UTF-8 address string. Must match
 * apps/api/src/xrpl/reference.ts exactly, since this is what createCommitment stores onchain
 * as xrplDestinationHash and every later proof is checked against.
 */
export function xrplAddressHash(address: string): Hex {
  return keccak256(toBytes(address.trim()));
}
