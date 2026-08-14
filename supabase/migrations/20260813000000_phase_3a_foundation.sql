create extension if not exists pgcrypto;

create type public.commitment_status as enum ('active', 'fulfilled', 'defaulted');
create type public.settlement_kind as enum ('created', 'fulfilled', 'defaulted');
create type public.notification_kind as enum ('commitment', 'settlement', 'security');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  wallet_address text unique check (wallet_address is null or wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallet_link_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  nonce_hash text not null unique,
  message text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  chain_id bigint not null,
  contract_address text not null check (contract_address ~ '^0x[0-9a-fA-F]{40}$'),
  commitment_id numeric(78,0) not null,
  payer_flare_address text not null,
  recipient_flare_address text not null,
  recipient_xrpl_address text not null,
  recipient_xrpl_address_hash text not null,
  xrp_amount_drops numeric(78,0) not null check (xrp_amount_drops > 0),
  fxrp_bond_amount numeric(78,0) not null check (fxrp_bond_amount > 0),
  payment_reference text not null,
  start_xrpl_ledger bigint not null,
  deadline_at timestamptz not null,
  cure_ends_at timestamptz not null,
  status public.commitment_status not null default 'active',
  create_tx_hash text not null,
  settlement_tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, contract_address, commitment_id),
  check (cure_ends_at >= deadline_at)
);

create table public.settlement_events (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  kind public.settlement_kind not null,
  transaction_hash text not null,
  block_number bigint not null,
  proof_reference text,
  created_at timestamptz not null default now(),
  unique (commitment_id, kind)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.wallet_link_challenges (user_id, expires_at);
create index on public.commitments (owner_id, created_at desc);
create index on public.settlement_events (owner_id, created_at desc);
create index on public.notifications (user_id, created_at desc);
create index on public.audit_logs (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.wallet_link_challenges enable row level security;
alter table public.commitments enable row level security;
alter table public.settlement_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy challenges_own on public.wallet_link_challenges for select to authenticated using ((select auth.uid()) = user_id);
create policy commitments_public_read on public.commitments for select to anon, authenticated using (true);
create policy settlement_events_public_read on public.settlement_events for select to anon, authenticated using (true);
create policy notifications_select_own on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy notifications_update_own on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy audit_logs_select_own on public.audit_logs for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.wallet_link_challenges, public.audit_logs from anon, authenticated;
grant select, update (display_name) on public.profiles to authenticated;
grant select on public.commitments, public.settlement_events to anon, authenticated;
grant select, update (read_at) on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles (id) values (new.id); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

comment on table public.commitments is 'Explicitly public onchain projection; owner_id is correlation metadata, not private data.';
comment on table public.settlement_events is 'Explicitly public settlement evidence derived from public chain events.';
