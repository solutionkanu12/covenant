import { createHash, randomBytes } from "node:crypto";
import { getAddress, isAddress, verifyMessage } from "viem";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export function hashNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}
export function createWalletChallenge(
  userId: string,
  walletAddress: string,
  now = new Date(),
) {
  if (!isAddress(walletAddress)) throw new Error("Invalid wallet address");
  const address = getAddress(walletAddress);
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const message = [
    `Covenant wallet link`,
    `User: ${userId}`,
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt.toISOString()}`,
  ].join("\n");
  return { address, nonce, nonceHash: hashNonce(nonce), message, expiresAt };
}
export async function isValidWalletSignature(
  message: string,
  address: string,
  signature: `0x${string}`,
) {
  return verifyMessage({ address: getAddress(address), message, signature });
}
