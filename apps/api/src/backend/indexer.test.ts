import assert from "node:assert/strict";
import test from "node:test";
import type { Address, Hex } from "viem";
import type { CovenantEventSource } from "../chain/coston2.js";
import { CovenantIndexer } from "./indexer.js";
import type { BackendRepository, CommitmentRecord } from "./repository.js";

const payer = "0x0000000000000000000000000000000000000001" as Address;
const beneficiary = "0x0000000000000000000000000000000000000002" as Address;
const transactionHash = `0x${"1".repeat(64)}` as Hex;
const settlementHash = `0x${"2".repeat(64)}` as Hex;

test("indexer persists contract events once and resumes from its checkpoint", async () => {
  let checkpoint: number | undefined;
  let commitment: CommitmentRecord | null = null;
  let eventReads = 0;
  const notifications: unknown[] = [];
  const settlements: unknown[] = [];
  const repository = {
    checkpoint: async () => checkpoint,
    saveCheckpoint: async (
      _chain: number,
      _contract: string,
      block: bigint,
    ) => {
      checkpoint = Number(block);
      return [];
    },
    profilesForWallets: async () => [
      { id: "payer-user", wallet_address: payer, is_admin: false },
      { id: "beneficiary-user", wallet_address: beneficiary, is_admin: false },
    ],
    upsertCommitment: async (body: Record<string, unknown>) => {
      commitment = { id: "row-1", ...body } as unknown as CommitmentRecord;
      return [commitment];
    },
    commitment: async () => commitment,
    updateCommitment: async (_id: string, body: Record<string, unknown>) => {
      commitment = { ...commitment!, ...body };
      return [commitment];
    },
    recordSettlement: async (body: unknown) => {
      settlements.push(body);
      return [];
    },
    notify: async (body: unknown) => {
      notifications.push(body);
      return [];
    },
  } as unknown as BackendRepository;
  const source: CovenantEventSource = {
    blockNumber: async () => 101n,
    events: async (fromBlock, toBlock) => {
      eventReads += 1;
      assert.equal(fromBlock, 100n);
      assert.equal(toBlock, 101n);
      return [
        {
          type: "created",
          blockNumber: 100n,
          logIndex: 0,
          transactionHash,
          args: {
            commitmentId: 7n,
            payer,
            beneficiary,
            xrplDestinationHash: `0x${"3".repeat(64)}`,
            xrpAmountDrops: 1_000_000n,
            collateralAmount: 2_000_000n,
            minimalLedger: 10n,
            deadlineLedger: 20n,
            deadlineTimestamp: 2_000_000_000n,
            paymentReference: `0x${"4".repeat(64)}`,
          },
        },
        {
          type: "settled",
          blockNumber: 101n,
          logIndex: 1,
          transactionHash: settlementHash,
          args: { commitmentId: 7n, status: 2, recipient: payer },
        },
      ];
    },
  };
  const indexer = new CovenantIndexer(source, repository, {
    chainId: 114,
    contractAddress: "0xcontract",
    startBlock: 100n,
    batchSize: 100n,
  });

  const first = await indexer.sync();
  const second = await indexer.sync();

  assert.equal(first.eventsProcessed, 2);
  assert.equal(second.eventsProcessed, 0);
  assert.equal(eventReads, 1);
  assert.equal(checkpoint, 101);
  assert.equal(commitment!.status, "fulfilled");
  assert.equal(settlements.length, 2);
  assert.equal(notifications.length, 4);
});
