# Phase 3B — Backend integration

Phase 3B connects the API to the deployed `CovenantEscrow` on Coston2 and the hosted Supabase
project. It does not generate XRPL payments or execute FDC proofs.

## Runtime services

- `GET /health` checks Coston2 RPC and Supabase independently.
- `GET /api/commitments` lists the indexed public projection. Optional `status`, `wallet`, and
  `limit` query parameters are validated by the API.
- `GET /api/commitments/:id` returns contract terms plus indexed creation/settlement evidence.
- `POST /api/indexer/sync` runs one synchronization batch and requires
  `X-Internal-API-Secret`. The API service also polls automatically.
- `GET /api/notifications` and `PATCH /api/notifications/:id/read` use the authenticated user's
  Supabase access token and row-level security.
- `GET /api/admin/commitments` and `GET /api/admin/analytics` require both a valid access token and
  a server-managed `profiles.is_admin` flag.

The indexer starts at deployment block `34013106`, reads only the deployed contract at
`0x841F714A57Ba1B1A77ef8b3732aCf825D593f017`, and stores its checkpoint after every successful
batch. Database uniqueness constraints and PostgREST upserts make replay safe. A failed batch does
not advance the checkpoint.

## Hosted deployment

Apply `20260814000000_phase_3b_backend.sql` to the hosted Supabase project through the approved
production migration workflow. Set the server-only environment variables documented in
`.env.example`; never expose the service-role key or internal API secret to the browser.

The first administrator must be promoted through a trusted Supabase administration workflow by
setting `profiles.is_admin = true` for the intended authenticated user. Client roles have no grant
to update that column.
