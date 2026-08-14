alter table public.profiles
  add column is_admin boolean not null default false;

revoke update (is_admin) on public.profiles from authenticated;

alter table public.commitments
  alter column recipient_xrpl_address drop not null,
  add column minimal_ledger bigint,
  add column deadline_ledger bigint,
  add column indexed_block_number bigint,
  add column indexed_log_index integer;

alter table public.commitments
  add constraint commitments_indexed_event_unique
  unique (chain_id, contract_address, indexed_block_number, indexed_log_index);

create table public.indexer_checkpoints (
  chain_id bigint not null,
  contract_address text not null,
  last_processed_block bigint not null,
  updated_at timestamptz not null default now(),
  primary key (chain_id, contract_address)
);

alter table public.indexer_checkpoints enable row level security;
revoke all on public.indexer_checkpoints from anon, authenticated;

alter table public.notifications
  add column source_event_key text unique;

create index commitments_status_created_idx
  on public.commitments (status, created_at desc);
create index commitments_payer_created_idx
  on public.commitments (payer_flare_address, created_at desc);
create index commitments_recipient_created_idx
  on public.commitments (recipient_flare_address, created_at desc);

comment on column public.profiles.is_admin is
  'Server-managed authorization flag; authenticated clients cannot update it.';
comment on table public.indexer_checkpoints is
  'Server-only Coston2 event synchronization cursor.';
