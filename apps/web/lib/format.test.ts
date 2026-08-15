import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatTokenAmount, truncateHex } from "./format";

describe("truncateHex", () => {
  it("shortens a full address with an ellipsis", () => {
    assert.equal(
      truncateHex("0x841F714A57Ba1B1A77ef8b3732aCf825D593f017"),
      "0x841F…f017",
    );
  });

  it("returns short values unchanged", () => {
    assert.equal(truncateHex("0x1234abcd"), "0x1234abcd");
  });

  it("passes through non-hex input", () => {
    assert.equal(truncateHex("not-an-address"), "not-an-address");
  });
});

describe("formatTokenAmount", () => {
  it("renders whole token amounts without a fraction", () => {
    assert.equal(formatTokenAmount(12_000_000n, 6), "12");
  });

  it("renders fractional amounts and trims trailing zeros", () => {
    assert.equal(formatTokenAmount(12_500_000n, 6), "12.5");
    assert.equal(formatTokenAmount(20_100n, 6), "0.0201");
  });

  it("honors the maximum fraction digit count", () => {
    assert.equal(formatTokenAmount(1_234_567n, 6, 2), "1.23");
  });

  it("keeps the sign on negative amounts", () => {
    assert.equal(formatTokenAmount(-2_500_000n, 6), "-2.5");
  });
});
