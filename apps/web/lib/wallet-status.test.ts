import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isWalletGatedPath,
  isWrongNetwork,
  normalizeChainId,
  shouldRedirectToLanding,
  shouldRedirectToVault,
} from "./wallet-status";
import { COSTON2_CHAIN_ID } from "./chains";

const BASE_SEPOLIA_CHAIN_ID = 84532;
const ETHEREUM_MAINNET_CHAIN_ID = 1;
const BASE_CHAIN_ID = 8453;
const ARBITRUM_CHAIN_ID = 42161;

describe("normalizeChainId", () => {
  it("passes numbers through unchanged", () => {
    assert.equal(normalizeChainId(114), 114);
  });

  it("parses hex-prefixed strings as hex", () => {
    assert.equal(normalizeChainId("0x72"), 114);
    assert.equal(normalizeChainId("0X72"), 114);
    assert.equal(normalizeChainId("0x1"), ETHEREUM_MAINNET_CHAIN_ID);
    assert.equal(normalizeChainId("0x2105"), BASE_CHAIN_ID);
    assert.equal(normalizeChainId("0x14a34"), BASE_SEPOLIA_CHAIN_ID);
    assert.equal(normalizeChainId("0xa4b1"), ARBITRUM_CHAIN_ID);
  });

  it("parses plain decimal strings as decimal", () => {
    assert.equal(normalizeChainId("114"), 114);
  });

  it("normalizes bigint values", () => {
    assert.equal(normalizeChainId(114n), 114);
  });

  it("returns undefined for unparseable input", () => {
    assert.equal(normalizeChainId("not-a-chain-id"), undefined);
    assert.equal(normalizeChainId(null), undefined);
    assert.equal(normalizeChainId(undefined), undefined);
  });
});

describe("isWrongNetwork", () => {
  it("is false while disconnected, regardless of chainId", () => {
    assert.equal(isWrongNetwork(false, undefined), false);
    assert.equal(isWrongNetwork(false, BASE_SEPOLIA_CHAIN_ID), false);
  });

  it("is false when connected on Coston2", () => {
    assert.equal(isWrongNetwork(true, COSTON2_CHAIN_ID), false);
  });

  it("is true when connected on any other chain, without special-casing any of them", () => {
    const otherChains = [
      ETHEREUM_MAINNET_CHAIN_ID, // Ethereum
      BASE_CHAIN_ID, // Base
      BASE_SEPOLIA_CHAIN_ID, // Base Sepolia
      ARBITRUM_CHAIN_ID, // Arbitrum
      10, // Optimism
      137, // Polygon
      56, // BSC
      43114, // Avalanche
      999999, // arbitrary/unknown custom chain
      undefined,
    ];
    for (const chainId of otherChains) {
      assert.equal(isWrongNetwork(true, chainId), true, `chainId=${chainId}`);
    }
  });
});

describe("shouldRedirectToVault", () => {
  it("only redirects when connected AND on Coston2", () => {
    assert.equal(shouldRedirectToVault(true, COSTON2_CHAIN_ID), true);
    assert.equal(shouldRedirectToVault(true, BASE_SEPOLIA_CHAIN_ID), false);
    assert.equal(shouldRedirectToVault(false, COSTON2_CHAIN_ID), false);
    assert.equal(shouldRedirectToVault(false, undefined), false);
  });
});

describe("shouldRedirectToLanding", () => {
  it("waits for mount before deciding", () => {
    assert.equal(shouldRedirectToLanding(false, false, false), false);
  });

  it("waits for reconnect attempts to settle before bouncing to /", () => {
    assert.equal(shouldRedirectToLanding(true, true, false), false);
  });

  it("redirects once mounted, not reconnecting, and truly disconnected", () => {
    assert.equal(shouldRedirectToLanding(true, false, false), true);
  });

  it("never redirects a connected wallet", () => {
    assert.equal(shouldRedirectToLanding(true, false, true), false);
  });
});

describe("isWalletGatedPath", () => {
  it("gates the vault and commitment routes", () => {
    assert.equal(isWalletGatedPath("/vault"), true);
    assert.equal(isWalletGatedPath("/commitments/new"), true);
    assert.equal(isWalletGatedPath("/commitments/abc-123"), true);
  });

  it("does not gate public marketing pages that reuse the dashboard chrome", () => {
    assert.equal(isWalletGatedPath("/how-it-works"), false);
    assert.equal(isWalletGatedPath("/deployment"), false);
    assert.equal(isWalletGatedPath("/"), false);
  });
});
