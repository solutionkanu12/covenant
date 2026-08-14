import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import {
  CHALLENGE_TTL_MS,
  createWalletChallenge,
  hashNonce,
  isValidWalletSignature,
} from "./wallet.js";

const account = privateKeyToAccount(
  "0x0000000000000000000000000000000000000000000000000000000000000001",
);
test("wallet challenges bind user, wallet, nonce and expiry", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  const first = createWalletChallenge("user-a", account.address, now);
  const second = createWalletChallenge("user-a", account.address, now);
  assert.notEqual(first.nonceHash, second.nonceHash);
  assert.match(first.message, /User: user-a/);
  assert.match(first.message, new RegExp(`Wallet: ${account.address}`));
  assert.equal(first.expiresAt.getTime(), now.getTime() + CHALLENGE_TTL_MS);
  assert.equal(first.nonceHash, hashNonce(first.nonce));
});
test("signature verification rejects a copied signature for another challenge", async () => {
  const first = createWalletChallenge("victim", account.address);
  const second = createWalletChallenge("victim", account.address);
  const signature = await account.signMessage({ message: first.message });
  assert.equal(
    await isValidWalletSignature(first.message, account.address, signature),
    true,
  );
  assert.equal(
    await isValidWalletSignature(second.message, account.address, signature),
    false,
  );
});
