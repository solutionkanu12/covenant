import type { CovenantEvent, CovenantEventSource } from "../chain/coston2.js";
import { BackendRepository } from "./repository.js";

export type IndexerConfig = {
  chainId: number;
  contractAddress: string;
  startBlock: bigint;
  batchSize: bigint;
};

export class CovenantIndexer {
  constructor(
    private readonly source: CovenantEventSource,
    private readonly repository: BackendRepository,
    private readonly config: IndexerConfig,
  ) {}

  async sync() {
    const latest = await this.source.blockNumber();
    const checkpoint = await this.repository.checkpoint(
      this.config.chainId,
      this.config.contractAddress,
    );
    const fromBlock =
      checkpoint === undefined
        ? this.config.startBlock
        : BigInt(checkpoint) + 1n;
    if (fromBlock > latest)
      return { fromBlock, toBlock: latest, eventsProcessed: 0, caughtUp: true };
    const toBlock =
      fromBlock + this.config.batchSize - 1n < latest
        ? fromBlock + this.config.batchSize - 1n
        : latest;
    const events = await this.source.events(fromBlock, toBlock);
    for (const event of events) await this.persist(event);
    await this.repository.saveCheckpoint(
      this.config.chainId,
      this.config.contractAddress,
      toBlock,
    );
    return {
      fromBlock,
      toBlock,
      eventsProcessed: events.length,
      caughtUp: toBlock === latest,
    };
  }

  private eventKey(event: CovenantEvent) {
    return `${this.config.chainId}:${event.transactionHash}:${event.logIndex}`;
  }

  private async persist(event: CovenantEvent) {
    if (event.type === "created") return this.created(event);
    return this.settled(event);
  }

  private async created(event: Extract<CovenantEvent, { type: "created" }>) {
    const { args } = event;
    const profiles = await this.repository.profilesForWallets([
      args.payer,
      args.beneficiary,
    ]);
    const payer = profiles.find(
      (profile) =>
        profile.wallet_address?.toLowerCase() === args.payer.toLowerCase(),
    );
    const deadline = new Date(
      Number(args.deadlineTimestamp) * 1000,
    ).toISOString();
    const rows = await this.repository.upsertCommitment({
      owner_id: payer?.id ?? null,
      chain_id: this.config.chainId,
      contract_address: this.config.contractAddress,
      commitment_id: args.commitmentId.toString(),
      payer_flare_address: args.payer,
      recipient_flare_address: args.beneficiary,
      recipient_xrpl_address: null,
      recipient_xrpl_address_hash: args.xrplDestinationHash,
      xrp_amount_drops: args.xrpAmountDrops.toString(),
      fxrp_bond_amount: args.collateralAmount.toString(),
      payment_reference: args.paymentReference,
      start_xrpl_ledger: Number(args.minimalLedger),
      minimal_ledger: Number(args.minimalLedger),
      deadline_ledger: Number(args.deadlineLedger),
      deadline_at: deadline,
      cure_ends_at: deadline,
      status: "active",
      create_tx_hash: event.transactionHash,
      indexed_block_number: Number(event.blockNumber),
      indexed_log_index: event.logIndex,
      updated_at: new Date().toISOString(),
    });
    const commitment = rows[0];
    if (!commitment)
      throw new Error(`Failed to persist commitment ${args.commitmentId}`);
    await this.repository.recordSettlement({
      commitment_id: commitment.id,
      owner_id: commitment.owner_id,
      kind: "created",
      transaction_hash: event.transactionHash,
      block_number: Number(event.blockNumber),
    });
    for (const profile of profiles) {
      await this.repository.notify({
        user_id: profile.id,
        kind: "commitment",
        title: "Commitment indexed",
        body: `Commitment #${args.commitmentId} is active on Coston2.`,
        source_event_key: `${this.eventKey(event)}:${profile.id}`,
      });
    }
    return commitment;
  }

  private async settled(event: Extract<CovenantEvent, { type: "settled" }>) {
    const status =
      event.args.status === 2
        ? "fulfilled"
        : event.args.status === 3
          ? "defaulted"
          : null;
    if (!status)
      throw new Error(`Unsupported settlement status ${event.args.status}`);
    const commitment = await this.repository.commitment(
      this.config.chainId,
      this.config.contractAddress,
      event.args.commitmentId.toString(),
    );
    if (!commitment)
      throw new Error(
        `Settlement references missing commitment ${event.args.commitmentId}`,
      );
    await this.repository.updateCommitment(commitment.id, {
      status,
      settlement_tx_hash: event.transactionHash,
      updated_at: new Date().toISOString(),
    });
    await this.repository.recordSettlement({
      commitment_id: commitment.id,
      owner_id: commitment.owner_id,
      kind: status,
      transaction_hash: event.transactionHash,
      block_number: Number(event.blockNumber),
    });
    const profiles = await this.repository.profilesForWallets([
      commitment.payer_flare_address,
      commitment.recipient_flare_address,
    ]);
    for (const profile of profiles) {
      await this.repository.notify({
        user_id: profile.id,
        kind: "settlement",
        title:
          status === "fulfilled"
            ? "Commitment fulfilled"
            : "Commitment defaulted",
        body: `Commitment #${event.args.commitmentId} was ${status} on Coston2.`,
        source_event_key: `${this.eventKey(event)}:${profile.id}`,
      });
    }
  }
}
