import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  estimateDeadlineLedger,
  fdcJobProgressIndex,
  isPastCure,
  isPastDeadline,
} from "./commitment-status";

describe("estimateDeadlineLedger", () => {
  it("never estimates below the current ledger plus the safety buffer", () => {
    const estimate = estimateDeadlineLedger(1000, 2_000_000, 2_000_000);
    assert.equal(estimate, 1060);
  });

  it("grows with the time remaining until the deadline", () => {
    const estimate = estimateDeadlineLedger(1000, 2_000_000, 2_000_300);
    assert.equal(estimate, 1000 + 100 + 60);
  });
});

describe("fdcJobProgressIndex", () => {
  it("orders the happy path from queued to settled", () => {
    assert.equal(fdcJobProgressIndex("queued"), 0);
    assert.equal(fdcJobProgressIndex("waiting_for_round"), 3);
    assert.equal(fdcJobProgressIndex("settled"), 6);
  });

  it("reports failed as a distinct, non-progressing state", () => {
    assert.equal(fdcJobProgressIndex("failed"), -1);
  });
});

describe("deadline and cure helpers", () => {
  it("treats an exact timestamp match as past", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    assert.equal(isPastDeadline("2026-01-01T00:00:00.000Z", now), true);
    assert.equal(isPastCure("2026-01-01T00:00:00.000Z", now), true);
  });

  it("reports a future timestamp as not yet past", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    assert.equal(isPastDeadline("2026-01-02T00:00:00.000Z", now), false);
  });
});
