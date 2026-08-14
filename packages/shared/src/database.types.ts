export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};
type Timestamped = { created_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Timestamped & {
          id: string;
          display_name: string | null;
          wallet_address: string | null;
          is_admin: boolean;
          updated_at: string;
        }
      >;
      wallet_link_challenges: Table<
        Timestamped & {
          id: string;
          user_id: string;
          wallet_address: string;
          nonce_hash: string;
          message: string;
          expires_at: string;
          consumed_at: string | null;
        }
      >;
      commitments: Table<
        Timestamped & {
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
          updated_at: string;
          indexed_block_number: number | null;
          indexed_log_index: number | null;
        }
      >;
      settlement_events: Table<
        Timestamped & {
          id: string;
          commitment_id: string;
          owner_id: string | null;
          kind: "created" | "fulfilled" | "defaulted";
          transaction_hash: string;
          block_number: number;
          proof_reference: string | null;
        }
      >;
      notifications: Table<
        Timestamped & {
          id: string;
          user_id: string;
          kind: "commitment" | "settlement" | "security";
          title: string;
          body: string;
          read_at: string | null;
          source_event_key: string | null;
        }
      >;
      indexer_checkpoints: Table<{
        chain_id: number;
        contract_address: string;
        last_processed_block: number;
        updated_at: string;
      }>;
      audit_logs: Table<
        Timestamped & {
          id: number;
          user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          metadata: Json;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      commitment_status: "active" | "fulfilled" | "defaulted";
      settlement_kind: "created" | "fulfilled" | "defaulted";
      notification_kind: "commitment" | "settlement" | "security";
    };
    CompositeTypes: Record<string, never>;
  };
};
