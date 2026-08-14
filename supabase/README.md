# Supabase Phase 3A foundation

Apply `migrations/` before loading `seed.sql`. Regenerate `packages/shared/src/database.types.ts`
from the applied local schema with:

```sh
supabase gen types --lang typescript --local > packages/shared/src/database.types.ts
```

`commitments` and `settlement_events` are explicit public, read-only projections of public chain
data. Profiles, wallet-link challenges, notifications, and audit logs are private. Browser clients
must use only the publishable key; the service-role key belongs exclusively to the API process.

Run `supabase db reset` and `supabase test db` when the Supabase CLI and a Docker daemon are
available.

Phase 3B adds the deployed-contract event checkpoint, server-managed administrator flag, and
notification idempotency key in `20260814000000_phase_3b_backend.sql`. Apply it to hosted Supabase
through the approved production migration workflow before starting the Phase 3B API.
