import assert from "node:assert/strict";
import test from "node:test";
import { commitmentAnalytics } from "./analytics.js";
import type { CommitmentRecord } from "./repository.js";

function commitment(
  status: CommitmentRecord["status"],
  xrp: string,
  collateral: string,
) {
  return {
    status,
    xrp_amount_drops: xrp,
    fxrp_bond_amount: collateral,
  } as CommitmentRecord;
}

test("commitment analytics use integer-safe totals and settled outcomes", () => {
  const result = commitmentAnalytics([
    commitment("active", "10", "100"),
    commitment("fulfilled", "20", "200"),
    commitment("defaulted", "30", "300"),
  ]);
  assert.deepEqual(result, {
    commitments: 3,
    statuses: { active: 1, fulfilled: 1, defaulted: 1 },
    totalXrpAmountDrops: "60",
    totalCollateralAmount: "600",
    fulfillmentRate: 0.5,
  });
});
