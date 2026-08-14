-- Public development-only projection. No auth users or credentials are seeded.
insert into public.commitments (
  chain_id, contract_address, commitment_id, payer_flare_address, recipient_flare_address,
  recipient_xrpl_address, recipient_xrpl_address_hash, xrp_amount_drops, fxrp_bond_amount,
  payment_reference, start_xrpl_ledger, deadline_at, cure_ends_at, status, create_tx_hash
) values (
  114, '0x841F714A57Ba1B1A77ef8b3732aCf825D593f017', 1,
  '0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002',
  'rExamplePublicSeedAddress', '0x0000000000000000000000000000000000000000000000000000000000000000',
  1000000, 1000000000000000000,
  '0x0000000000000000000000000000000000000000000000000000000000000001',
  1, '2030-01-01T00:00:00Z', '2030-01-02T00:00:00Z', 'active',
  '0x0000000000000000000000000000000000000000000000000000000000000001'
) on conflict do nothing;
