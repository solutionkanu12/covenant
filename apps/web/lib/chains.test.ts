import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COSTON2_CHAIN_ID,
  coston2,
  coston2ExplorerUrl,
  explorerAddressUrl,
} from "./chains";

describe("coston2 chain config", () => {
  it("targets Flare Coston2, chain id 114", () => {
    assert.equal(COSTON2_CHAIN_ID, 114);
    assert.equal(coston2.id, 114);
  });

  it("builds explorer address URLs without a double slash", () => {
    const address = "0x841F714A57Ba1B1A77ef8b3732aCf825D593f017";
    assert.equal(
      explorerAddressUrl(address),
      `${coston2ExplorerUrl}/address/${address}`,
    );
    assert.ok(!coston2ExplorerUrl.endsWith("/"));
  });
});
