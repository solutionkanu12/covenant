import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { txExplorerLink, txStatusLabel } from "./tx";

describe("txStatusLabel", () => {
  it("labels every lifecycle state", () => {
    assert.equal(txStatusLabel("idle"), "Ready");
    assert.equal(txStatusLabel("signing"), "Waiting for signature");
    assert.equal(txStatusLabel("pending"), "Confirming on Coston2");
    assert.equal(txStatusLabel("confirmed"), "Confirmed");
    assert.equal(txStatusLabel("failed"), "Failed");
  });
});

describe("txExplorerLink", () => {
  it("builds a Coston2 explorer transaction URL", () => {
    const hash =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    assert.equal(
      txExplorerLink(hash),
      `https://coston2-explorer.flare.network/tx/${hash}`,
    );
  });
});
