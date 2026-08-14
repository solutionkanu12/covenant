import type { CommitmentRecord } from "./repository.js";

export function commitmentAnalytics(rows: CommitmentRecord[]) {
  const statuses = { active: 0, fulfilled: 0, defaulted: 0 };
  let xrpAmountDrops = 0n;
  let collateralAmount = 0n;
  for (const row of rows) {
    statuses[row.status] += 1;
    xrpAmountDrops += BigInt(row.xrp_amount_drops);
    collateralAmount += BigInt(row.fxrp_bond_amount);
  }
  const settled = statuses.fulfilled + statuses.defaulted;
  return {
    commitments: rows.length,
    statuses,
    totalXrpAmountDrops: xrpAmountDrops.toString(),
    totalCollateralAmount: collateralAmount.toString(),
    fulfillmentRate:
      settled === 0 ? null : Number((statuses.fulfilled / settled).toFixed(4)),
  };
}
