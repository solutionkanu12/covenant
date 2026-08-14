import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";

export type CreatedEvent = {
  type: "created";
  blockNumber: bigint;
  logIndex: number;
  transactionHash: Hex;
  args: {
    commitmentId: bigint;
    payer: Address;
    beneficiary: Address;
    xrplDestinationHash: Hex;
    xrpAmountDrops: bigint;
    collateralAmount: bigint;
    minimalLedger: bigint;
    deadlineLedger: bigint;
    deadlineTimestamp: bigint;
    paymentReference: Hex;
  };
};

export type SettledEvent = {
  type: "settled";
  blockNumber: bigint;
  logIndex: number;
  transactionHash: Hex;
  args: {
    commitmentId: bigint;
    status: number;
    recipient: Address;
  };
};

export type CovenantEvent = CreatedEvent | SettledEvent;

export interface CovenantEventSource {
  blockNumber(): Promise<bigint>;
  events(fromBlock: bigint, toBlock: bigint): Promise<CovenantEvent[]>;
}

const created = parseAbiItem(
  "event CommitmentCreated(uint256 indexed commitmentId,address indexed payer,address indexed beneficiary,bytes32 xrplDestinationHash,uint256 xrpAmountDrops,uint256 collateralAmount,uint64 minimalLedger,uint64 deadlineLedger,uint64 deadlineTimestamp,bytes32 paymentReference)",
);
const settled = parseAbiItem(
  "event CommitmentSettled(uint256 indexed commitmentId,uint8 status,address recipient)",
);

export function createCoston2EventSource(rpcUrl: string, address: Address) {
  const client = createPublicClient({
    transport: http(rpcUrl, { timeout: 15_000 }),
  });
  return {
    blockNumber: () => client.getBlockNumber(),
    async events(fromBlock: bigint, toBlock: bigint) {
      const [createdLogs, settledLogs] = await Promise.all([
        client.getLogs({
          address,
          event: created,
          fromBlock,
          toBlock,
          strict: true,
        }),
        client.getLogs({
          address,
          event: settled,
          fromBlock,
          toBlock,
          strict: true,
        }),
      ]);
      const events: CovenantEvent[] = [
        ...createdLogs.map((log) => ({
          type: "created" as const,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          transactionHash: log.transactionHash,
          args: log.args,
        })),
        ...settledLogs.map((log) => ({
          type: "settled" as const,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          transactionHash: log.transactionHash,
          args: log.args,
        })),
      ];
      return events.sort(
        (a, b) =>
          Number(a.blockNumber - b.blockNumber) || a.logIndex - b.logIndex,
      );
    },
  } satisfies CovenantEventSource;
}
