export const productName = "Covenant";

export type HealthStatus = {
  service: typeof productName;
  status: "ok";
};

/** API/client-facing fragment for creating commitments and decoding their generated references. */
export const covenantEscrowCreateAbi = [
  {
    type: "function",
    name: "createCommitment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "beneficiary", type: "address" },
      { name: "xrplDestinationHash", type: "bytes32" },
      { name: "xrpAmountDrops", type: "uint256" },
      { name: "collateralAmount", type: "uint256" },
      { name: "minimalLedger", type: "uint64" },
      { name: "deadlineLedger", type: "uint64" },
      { name: "deadlineTimestamp", type: "uint64" },
    ],
    outputs: [
      { name: "commitmentId", type: "uint256" },
      { name: "paymentReference", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "CommitmentCreated",
    inputs: [
      { name: "commitmentId", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "beneficiary", type: "address", indexed: false },
      { name: "xrplDestinationHash", type: "bytes32", indexed: false },
      { name: "xrpAmountDrops", type: "uint256", indexed: false },
      { name: "collateralAmount", type: "uint256", indexed: false },
      { name: "minimalLedger", type: "uint64", indexed: false },
      { name: "deadlineLedger", type: "uint64", indexed: false },
      { name: "deadlineTimestamp", type: "uint64", indexed: false },
      { name: "paymentReference", type: "bytes32", indexed: false },
    ],
  },
] as const;
