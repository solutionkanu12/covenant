# Deployment

## Network

Flare Coston2 testnet, chain ID `114`.

- RPC: `https://coston2-api.flare.network/ext/C/rpc`
- Explorer: `https://coston2-explorer.flare.network`

## Contracts

| Contract | Address | Explorer |
| --- | --- | --- |
| CovenantEscrow | `0x841F714A57Ba1B1A77ef8b3732aCf825D593f017` | <https://coston2-explorer.flare.network/address/0x841F714A57Ba1B1A77ef8b3732aCf825D593f017> |
| FTestXRP (collateral token) | `0x0b6A3645c240605887a5532109323A3E12273dc7` | <https://coston2-explorer.flare.network/address/0x0b6A3645c240605887a5532109323A3E12273dc7> |
| FdcVerification | `0x906507E0B64bcD494Db73bd0459d1C667e14B933` | <https://coston2-explorer.flare.network/address/0x906507E0B64bcD494Db73bd0459d1C667e14B933> |

- Deployment block: `34013106`
- Deployment transaction: `0x87d72a97049a4f549dcef2777db2a780b1bb95d29bfd385470115477a61ce2c3`
- Gas used: `2590405`

The deployed runtime bytecode and both immutable dependency getters (`collateralToken`, `fdcVerification`) were confirmed live against the Coston2 RPC after deployment; see `docs/PHASE-2-COSTON2-DEPLOYMENT.md` for the original record. That check was a direct RPC read of the deployed contract, not a block-explorer source-verification submission, so this repository does not claim the contract source is marked verified on the Coston2 explorer. No keystore, password, private key, or Foundry broadcast artifact is stored in this repository.

The contract's `collateralToken` and `fdcVerification` addresses are immutable and were set at deployment to the FTestXRP and FdcVerification addresses above; they are not something the frontend or API selects independently, `packages/shared/src/index.ts` records them for client convenience.

## Frontend and API deployment status

Neither `apps/web` nor `apps/api` is currently deployed to a public host from this repository. There is no hosting configuration file (no `wrangler.toml`, `render.yaml`, `vercel.json`, or equivalent) checked in, and no CI/CD workflow exists yet. Both currently run locally only:

```bash
pnpm --filter @covenant/api dev    # http://localhost:3001
pnpm --filter @covenant/web dev    # http://localhost:3000
```

The web app's Next.js server proxies `/api/*` requests to `COVENANT_API_URL` (default `http://localhost:3001`) in local development.

## Required environment variables

Names only; see `.env.example` for the authoritative list and inline documentation. Never commit real values.

### Public, non-secret

- `COSTON2_RPC_URL`: Coston2 JSON-RPC endpoint.
- `XRPL_TESTNET_URL`: XRPL Testnet WebSocket endpoint.
- `FDC_VERIFIER_URL`: Flare's public XRP FDC verifier endpoint.
- `NEXT_PUBLIC_COSTON2_RPC_URL`: optional browser-side RPC override.
- `COVENANT_API_URL`: where the web app's server proxies `/api/*` in local development.

### Supabase

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`: safe to expose to the browser only because row-level security is enabled on every table it can reach.
- `SUPABASE_SERVICE_ROLE_KEY`: server only. Never prefix with `NEXT_PUBLIC_` or expose it to a browser bundle; it bypasses row-level security.

### Backend

- `INTERNAL_API_SECRET`: gates `POST /api/indexer/sync`.
- `INDEXER_START_BLOCK`, `INDEXER_BATCH_SIZE`, `INDEXER_POLL_INTERVAL_MS`: indexer tuning; defaults match the deployment block above and the public RPC's `eth_getLogs` block-range cap.

### XRPL Testnet fixtures

- `XRPL_TESTNET_PAYER_SEED`, `XRPL_TESTNET_RECIPIENT_SEED`: used only by the local, read-only proof/reproduction scripts documented under `docs/PHASE-1B-XRPL-PAYMENT.md`. Testnet-only, gitignored, never committed.

### Optional

- `XAMAN_API_KEY`, `XAMAN_API_SECRET`: when unset, the payment-request endpoint still returns the complete, copyable XRPL transaction JSON; only the QR/deeplink convenience is skipped.
- `COSTON2_EXECUTOR_PRIVATE_KEY`: when unset, FDC jobs still prepare and poll (both read-only) but pause before submitting a transaction. See `docs/SECURITY.md` for what this key can and cannot do.

## Supabase project

Apply the migrations in `supabase/migrations/` in filename order to a Supabase Postgres project:

```text
20260813000000_phase_3a_foundation.sql
20260814000000_phase_3b_backend.sql
20260814010000_service_role_grants.sql
20260814020000_phase_6_xrpl_observations.sql
20260814030000_phase_7_fdc_jobs.sql
```

The first administrator must be promoted by setting `profiles.is_admin = true` directly through a trusted Supabase administration workflow; no client role can set that column itself.

## XRPL Testnet

Covenant reads XRPL Testnet only; it never broadcasts a payment on the user's behalf. The public endpoint used for both local checks and the API is `wss://s.altnet.rippletest.net:51233`.

## FDC infrastructure

- Verifier: `https://fdc-verifiers-testnet.flare.network/verifier/xrp` (public XRP FDC verifier for attestation preparation).
- Data Availability: the executor fetches finalized proofs from Flare's official Coston2 DA service once a voting round is finalized; see `apps/api/src/fdc/coston2Fdc.ts`.
- Contract resolution: the executor resolves current FDC contracts (`FdcHub`, `Relay`, `FlareSystemsManager`) through Flare's Contract Registry rather than hardcoding addresses that could go stale.
