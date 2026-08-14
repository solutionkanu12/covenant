create type public.fdc_attestation_type as enum ('payment', 'referenced_payment_nonexistence');
create type public.fdc_job_status as enum (
  'queued',
  'prepared',
  'submitted',
  'waiting_for_round',
  'proof_ready',
  'settlement_submitted',
  'settled',
  'retryable_error',
  'failed'
);

create table public.fdc_jobs (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  attestation_type public.fdc_attestation_type not null,
  request_bytes text,
  request_tx_hash text,
  round_id numeric(78, 0),
  status public.fdc_job_status not null default 'queued',
  -- Set only while status = 'retryable_error': the step to resume, so restart recovery is
  -- purely data-driven from persisted state rather than inferred.
  next_step public.fdc_job_status,
  attempt_count integer not null default 0,
  proof_json jsonb,
  settlement_tx_hash text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commitment_id, attestation_type)
);

alter table public.fdc_jobs enable row level security;
grant select on public.fdc_jobs to anon, authenticated;
grant select, insert, update, delete on public.fdc_jobs to service_role;

create index fdc_jobs_status_idx on public.fdc_jobs (status);

comment on table public.fdc_jobs is
  'Persisted FDC attestation job state. Restart-safe: the executor resumes from the stored status.';
comment on column public.fdc_jobs.round_id is
  'FDC voting round id; large enough to hold a uint256-derived round number.';
