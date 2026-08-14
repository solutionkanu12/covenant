create table public.xrpl_observations (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  transaction_hash text not null check (transaction_hash ~ '^[0-9A-Fa-f]{64}$'),
  ledger_index bigint not null,
  validated boolean not null,
  destination text not null,
  delivered_amount_drops numeric(78, 0) not null,
  payment_reference text not null,
  observed_at timestamptz not null default now(),
  unique (commitment_id, transaction_hash)
);

alter table public.xrpl_observations enable row level security;
grant select on public.xrpl_observations to anon, authenticated;
grant select, insert, update, delete on public.xrpl_observations to service_role;

create index xrpl_observations_commitment_idx
  on public.xrpl_observations (commitment_id, observed_at desc);

comment on table public.xrpl_observations is
  'Informational XRPL payment sightings. Never authoritative for settlement; only a verified FDC proof settles a commitment.';
