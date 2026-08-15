/** Mirrors the indexed row shapes the Covenant API returns. Onchain data is authoritative. */

export type CommitmentStatus = "active" | "fulfilled" | "defaulted";

export type CommitmentRecord = {
  id: string;
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
  status: CommitmentStatus;
  create_tx_hash: string;
  settlement_tx_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type SettlementEventKind = "created" | "fulfilled" | "defaulted";

export type SettlementEvent = {
  id: string;
  kind: SettlementEventKind;
  transaction_hash: string;
  block_number: number;
  proof_reference: string | null;
  created_at: string;
};

export type FdcAttestationType = "payment" | "referenced_payment_nonexistence";

export type FdcJobStatus =
  | "queued"
  | "prepared"
  | "submitted"
  | "waiting_for_round"
  | "proof_ready"
  | "settlement_submitted"
  | "settled"
  | "retryable_error"
  | "failed";

export type FdcJobRecord = {
  id: string;
  commitment_id: string;
  attestation_type: FdcAttestationType;
  status: FdcJobStatus;
  attempt_count: number;
  settlement_tx_hash: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type XrplPaymentPayload = {
  TransactionType: "Payment";
  Destination: string;
  Amount: string;
  Memos: [{ Memo: { MemoData: string } }];
};

export type PaymentRequestResponse = {
  commitmentId: string;
  transaction: XrplPaymentPayload;
  transactionJson: string;
  xaman: { uuid: string; qrPng: string; deeplink: string } | null;
};

export type PaymentObservationResponse = {
  observed: true;
  valid: true;
  ledgerIndex: number;
  deliveredAmountDrops: string;
  destination: string;
  note: string;
};

export type XrplLedgerSnapshot = { ledgerIndex: number; closeTimeUnix: number };
