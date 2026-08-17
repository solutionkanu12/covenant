# Architecture

This document describes Covenant's current architecture: trust boundaries, data flow, and how each component behaves under normal operation and under failure.

## Components

```text
Browser (Next.js, wagmi/viem, TanStack Query)
  |
  |-- EVM wallet -----------> Flare Coston2 (chain id 114)
  |                             CovenantEscrow.sol
  |                             FXRP (collateral token)
  |                             FdcVerification
  |
  |-- Xaman / XRPL wallet --> XRPL Testnet
  |
  `-- HTTPS ----------------> Covenant API (Fastify, apps/api)
                                |-- Coston2 JSON-RPC (event source)
                                |-- XRPL Testnet JSON-RPC/WebSocket
                                |-- FDC verifier + Data Availability API
                                `-- Supabase Postgres (REST/PostgREST)
```

## Trust boundaries

Covenant has one authoritative source of truth: `CovenantEscrow` on Coston2. Every other component is either a read-only observer of that contract, a read-only observer of XRPL, or a cache/job queue that can be rebuilt from on-chain events.

- **The browser is untrusted input.** It supplies commitment terms and an XRPL destination address, but never a payment reference, a settlement outcome, or a status. The contract computes the reference itself; the API rejects a destination that does not hash-match the commitment's on-chain `xrplDestinationHash`.
- **The API is not authoritative for settlement.** It orchestrates FDC proof requests and submits proofs, but `CovenantEscrow` independently re-derives every settlement-relevant field from the proof and only moves funds if its own checks pass. A compromised or buggy API can at worst fail to settle a commitment or submit a proof that gets rejected; it cannot move a bond to the wrong address, because the contract computes the recipient itself.
- **Supabase is a projection, not a ledger.** `commitments`, `settlement_events`, `fdc_jobs`, and `xrpl_observations` are populated by indexing real contract events and real XRPL/FDC responses. Re-running the indexer from a contract event log should reconstruct the same public state. The database never sets a commitment's status directly; the indexer only writes what the chain already emitted.
- **The optional executor key is gas-only.** `COSTON2_EXECUTOR_PRIVATE_KEY`, when set, funds `submitRequest`, `settlePaid`, and `settleDefault` calls. It never holds FXRP or XRP and cannot choose a settlement beneficiary, since the contract computes the recipient from the commitment's own stored terms regardless of who calls the settlement function.

## Data flow

### Commitment creation

1. The payer connects an EVM wallet and the frontend confirms it is on Coston2.
2. The payer submits terms (beneficiary, XRPL destination, XRP amount, FXRP bond, deadline). The frontend validates addresses and amounts client-side before any transaction.
3. The payer approves FXRP and calls `createCommitment`. The contract computes a payment reference from `keccak256(domain, chainId, contract address, payer, commitmentId)`, marks it used, records the commitment as `Active`, and pulls the bond via `SafeERC20.safeTransferFrom`, checking its own balance delta before and after the transfer.
4. The API's indexer picks up the `CommitmentCreated` event on its next poll, upserts a row into `commitments`, and records the creation event in `settlement_events`. `indexer_checkpoints` tracks the last processed block so a restart neither re-processes nor skips events.

### XRPL payment path

1. `POST /api/commitments/:id/payment-request` takes only the recipient's XRPL destination address from the caller. The API hashes it with Flare's standard scheme (`keccak256(utf8Bytes(address))`) and rejects it unless it matches the commitment's stored `recipient_xrpl_address_hash`. The XRP amount and payment reference always come from the indexed commitment, never from the request body.
2. The API returns the exact XRPL `Payment` transaction JSON (destination, drops amount, one `Memo.MemoData` equal to the reference), and, if Xaman credentials are configured, a QR/deeplink. The payer signs this directly in their own XRPL wallet; Covenant never holds the private key or the XRP.
3. `POST /api/commitments/:id/payment-observation` optionally records a submitted transaction hash as evidence, after independently looking it up on XRPL and structurally validating its type, memo, destination, and delivered amount against the commitment. This observation is informational only. It is never treated as proof of settlement and cannot itself trigger a payout.

### FDC proof path (fulfilled)

1. `POST /api/commitments/:id/prove-payment` requires an existing validated `xrpl_observations` row for the commitment; without one it returns `400`. This means an FDC proof job can never start from a payment the API has not itself independently verified against XRPL.
2. The job pipeline (`advanceFdcJob`, `apps/api/src/fdc/jobProcessor.ts`) moves a persisted `fdc_jobs` row through `queued -> prepared -> submitted -> waiting_for_round -> proof_ready -> settled`, calling the real FDC verifier to prepare the request, submitting it to `FdcHub`, polling for round finalization, and fetching the proof from the Data Availability layer.
3. Once `proof_ready`, the executor calls `settlePaid` with the decoded proof. `CovenantEscrow` re-checks the proof's attestation type, source chain, destination hash, reference, received amount, and timing against the commitment before calling `FdcVerification.verifyPayment` and transferring the bond back to the payer.

### FDC proof path (default)

1. `POST /api/commitments/:id/prove-default` returns `409` until the commitment's `cure_ends_at` has passed (currently equal to the deadline itself; see Limitations in the README).
2. The same job pipeline prepares a `ReferencedPaymentNonexistence` request instead, using the committed amount minus one drop, matching FDC's semantics that RPN proves no payment strictly greater than the requested amount exists.
3. `settleDefault` requires `block.timestamp` to already be past the commitment's deadline, checks every request field (ledger range, deadline, destination hash, reference, amount) against the commitment, requires the response's overflow ledger/timestamp to be past the deadline, calls `FdcVerification.verifyReferencedPaymentNonexistence`, and transfers the bond to the recorded beneficiary.

## Backend responsibilities

- Index `CovenantEscrow` events into a searchable, publicly readable projection.
- Generate and validate XRPL payment payloads without ever taking custody of a key.
- Run the FDC job state machine: prepare, submit, poll, fetch proof, submit settlement.
- Resume a job from its last persisted state after a restart, rather than restarting the pipeline (`retryable_error` jobs record and resume from `next_step`).
- Treat a settlement failure caused by the commitment already being settled as success rather than an error, since the contract's own state is authoritative and a duplicate submission is not a bug.

## Supabase's role

Supabase Postgres, accessed through PostgREST, stores:

- `commitments`: the indexed projection of on-chain commitment state.
- `settlement_events`: creation and settlement event history per commitment.
- `fdc_jobs`: one row per `(commitment_id, attestation_type)`, unique-constrained so repeated proof requests resolve to the same job instead of creating duplicates.
- `xrpl_observations`: recorded, independently validated XRPL payment observations, evidence only.
- `indexer_checkpoints`: the last successfully processed Coston2 block, so indexing is resumable and idempotent.
- `profiles`, `wallet_link_challenges`, `notifications`, `audit_logs`: wallet-linked user accounts and their notifications, gated by Supabase row-level security and a service-role boundary described in `docs/SECURITY.md`.

## Frontend's role

The frontend (`apps/web`) connects the wallet, enforces the Coston2 network, drives the guided commitment-creation flow, renders the API's indexed data and the FDC job progress, and presents the generated XRPL payment request. It contains no private key, no Supabase service-role key, and no internal API secret; every privileged action happens either in the user's own wallet or on the server.

## Failure and recovery behavior

- **FDC round still pending**: the job stays in `waiting_for_round`; the UI shows progress and polling continues without blocking.
- **Executor restart**: `fdc_jobs` persists `status` and `next_step`, so `advanceFdcJob` resumes exactly where it left off rather than re-preparing or re-submitting a request.
- **Settlement already submitted elsewhere**: if `settlePaid`/`settleDefault` fails because the commitment already left `Active` status, the job is marked `settled` without resubmitting, since the contract's state is always authoritative.
- **Xaman payload creation fails or is not configured**: the response still includes the complete, copyable XRPL transaction JSON, so the payer is never blocked from paying.
- **Indexer batch fails**: the checkpoint does not advance, so the next run retries the same block range rather than skipping it.
- **Upstream Supabase/PostgREST failure**: API routes return `502` with the cause logged server-side, never a bare `500` and never a fabricated empty result; an actually empty result set (no matching commitments) still returns `200` with `[]`.
