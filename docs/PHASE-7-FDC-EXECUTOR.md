# Phase 7 — FDC executor

Phase 7 implements the persisted FDC job state machine that proves an XRPL payment happened
(`Payment`) or did not happen by the deadline (`ReferencedPaymentNonexistence`), then submits
the resulting proof to `CovenantEscrow`.

## Job state machine

`fdc_jobs` (one row per `commitment_id, attestation_type`) persists:

```
queued -> prepared -> submitted -> waiting_for_round -> proof_ready -> settled
  any step -> retryable_error (records next_step, resumes there) -> failed (after 8 attempts)
```

`advanceFdcJob` (`apps/api/src/fdc/jobProcessor.ts`) advances a job by exactly one step and is
safe to call repeatedly: `settled`/`failed` are no-ops, and a `retryable_error` job resumes at
its persisted `next_step` rather than restarting the pipeline — this is what makes worker
restarts and repeated API calls safe without duplicating work. If a settlement submission
fails because the commitment already left `active` status (the job's own earlier attempt
landed but crashed before persisting, another instance settled it, or a manual settlement
occurred), the job is marked `settled` without resubmitting — the contract's own state is
always authoritative and settlement never happens twice.

`error_code: "EXECUTOR_KEY_MISSING"` is never escalated to `failed` by the attempt budget,
since it reflects missing configuration, not a broken job.

## Payment path

Only starts once Phase 6 has recorded a validated `xrpl_observations` row for the commitment
(`POST /api/commitments/:id/prove-payment` returns `400` otherwise) — an FDC proof job can
never begin from an unverified or client-asserted payment. The request body's
`transactionId` comes from that observation, never from the caller.

## Default path

`POST /api/commitments/:id/prove-default` returns `409` before `cure_ends_at`. The RPN
request's `amount` is the committed drops minus one, matching the contract's own comment:
FDC RPN proves no payment *strictly greater than* the requested amount exists, so `N - 1`
proves no payment satisfying the `N`-drop commitment exists.

## Idempotency

`getOrCreateFdcJob` inserts with `Prefer: resolution=ignore-duplicates` on the
`(commitment_id, attestation_type)` unique key and re-selects on conflict, so repeating
`prove-payment` or `prove-default` always resolves to the same job row — never a second,
conflicting job.

## API routes (task 47)

- `POST /api/commitments/:id/prove-payment`
- `POST /api/commitments/:id/prove-default`
- `GET /api/fdc/jobs/:id`

## Executor key

`COSTON2_EXECUTOR_PRIVATE_KEY` is optional. Unset, jobs prepare and poll normally (both of
which are read-only) and pause at request/proof submission with `error_code:
"EXECUTOR_KEY_MISSING"`; set, the same code path signs and submits for real. The key only
ever pays gas — it cannot choose a settlement beneficiary or custody user funds, since
`settlePaid`/`settleDefault` on `CovenantEscrow` compute the recipient from the commitment's
own stored terms.

## What was verified live in this environment, and what was not

This environment has no `COSTON2_EXECUTOR_PRIVATE_KEY` and no real active commitment exists
on Coston2 yet (commitment creation is Phase 9), so the actual request-submission and
proof-submission transactions could not be exercised end-to-end here — that is reported
honestly below rather than fabricated.

Verified live against real infrastructure (no mocks):
- `Payment` and `ReferencedPaymentNonexistence` `prepareRequest` calls to the real FDC
  verifier, both returning `VALID` with real ABI-encoded request bytes.
- Voting-round finalization checks against the real, already-finalized Phase 1 rounds
  (`1422765` for Payment, `1423091` for RPN) via the real `FlareSystemsManager`/`Relay`
  contracts.
- Full DA proof fetch and decode for the Payment attestation, reproducing the exact
  `1,000,000`-drop delivered amount from the real Phase 1 fixture.

Not reproduced live: the RPN DA proof fetch, because the freshly re-derived request bytes
(valid, but generated fresh in this session) don't byte-match the *specific* historical
request transaction that round `1423091` was actually voted on — the same `fetchProof` code
path that succeeded for Payment. Also not exercised: `submitRequest`, `settlePaid`, and
`settleDefault`, since both require a funded executor key and, for settlement, a real active
commitment — neither exists in this environment.

State-machine correctness (every transition, retry/backoff, restart recovery from a
persisted `retryable_error`/`waiting_for_round` row, and the already-settled self-heal path)
is covered by unit tests against every dependency, independent of live network access.
