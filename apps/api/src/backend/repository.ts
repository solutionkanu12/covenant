import type { SupabaseHttpClient } from "../supabase/client.js";

export type CommitmentRecord = {
  id: string;
  owner_id: string | null;
  chain_id: number;
  contract_address: string;
  commitment_id: string;
  payer_flare_address: string;
  recipient_flare_address: string;
  recipient_xrpl_address: string | null;
  recipient_xrpl_address_hash: string;
  xrp_amount_drops: string;
  fxrp_bond_amount: string;
  payment_reference: string;
  start_xrpl_ledger: number;
  minimal_ledger: number | null;
  deadline_ledger: number | null;
  deadline_at: string;
  cure_ends_at: string;
  status: "active" | "fulfilled" | "defaulted";
  create_tx_hash: string;
  settlement_tx_hash: string | null;
  indexed_block_number: number | null;
  indexed_log_index: number | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRecord = {
  id: string;
  wallet_address: string | null;
  is_admin: boolean;
};

const commitmentFields =
  "id,owner_id,chain_id,contract_address,commitment_id,payer_flare_address,recipient_flare_address,recipient_xrpl_address,recipient_xrpl_address_hash,xrp_amount_drops,fxrp_bond_amount,payment_reference,start_xrpl_ledger,minimal_ledger,deadline_ledger,deadline_at,cure_ends_at,status,create_tx_hash,settlement_tx_hash,indexed_block_number,indexed_log_index,created_at,updated_at";

export class BackendRepository {
  constructor(private readonly admin: SupabaseHttpClient) {}

  health() {
    return this.admin.health();
  }

  listCommitments(filter = "order=created_at.desc&limit=100") {
    return this.admin
      .from<CommitmentRecord>("commitments")
      .select(commitmentFields, filter);
  }

  async commitment(chainId: number, contract: string, id: string) {
    const rows = await this.admin
      .from<CommitmentRecord>("commitments")
      .select(
        commitmentFields,
        `chain_id=eq.${chainId}&contract_address=eq.${contract}&commitment_id=eq.${encodeURIComponent(id)}&limit=1`,
      );
    return rows[0] ?? null;
  }

  upsertCommitment(body: Record<string, unknown>) {
    return this.admin
      .from<CommitmentRecord>("commitments")
      .upsert(body, "chain_id,contract_address,commitment_id");
  }

  updateCommitment(id: string, body: Record<string, unknown>) {
    return this.admin
      .from<CommitmentRecord>("commitments")
      .update(`id=eq.${id}`, body);
  }

  settlementEvents(commitmentId: string) {
    return this.admin
      .from("settlement_events")
      .select(
        "id,kind,transaction_hash,block_number,proof_reference,created_at",
        `commitment_id=eq.${commitmentId}&order=block_number.asc`,
      );
  }

  async checkpoint(chainId: number, contract: string) {
    const rows = await this.admin
      .from<{ last_processed_block: number }>("indexer_checkpoints")
      .select(
        "last_processed_block",
        `chain_id=eq.${chainId}&contract_address=eq.${contract}&limit=1`,
      );
    return rows[0]?.last_processed_block;
  }

  saveCheckpoint(chainId: number, contract: string, block: bigint) {
    return this.admin.from("indexer_checkpoints").upsert(
      {
        chain_id: chainId,
        contract_address: contract,
        last_processed_block: Number(block),
        updated_at: new Date().toISOString(),
      },
      "chain_id,contract_address",
    );
  }

  async profilesForWallets(wallets: string[]) {
    const found: ProfileRecord[] = [];
    for (const wallet of new Set(wallets.map((value) => value.toLowerCase()))) {
      const rows = await this.admin
        .from<ProfileRecord>("profiles")
        .select(
          "id,wallet_address,is_admin",
          `wallet_address=ilike.${wallet}&limit=1`,
        );
      if (rows[0]) found.push(rows[0]);
    }
    return found;
  }

  async isAdmin(userId: string) {
    const rows = await this.admin
      .from<ProfileRecord>("profiles")
      .select("id,wallet_address,is_admin", `id=eq.${userId}&limit=1`);
    return rows[0]?.is_admin === true;
  }

  recordSettlement(body: Record<string, unknown>) {
    return this.admin
      .from("settlement_events")
      .upsert(body, "commitment_id,kind");
  }

  notify(body: Record<string, unknown>) {
    return this.admin.from("notifications").upsert(body, "source_event_key");
  }

  recordXrplObservation(body: Record<string, unknown>) {
    return this.admin
      .from("xrpl_observations")
      .upsert(body, "commitment_id,transaction_hash");
  }
}
