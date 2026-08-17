# Security

This document covers only protections that are implemented and can be pointed to in the code, plus the trust assumptions Covenant relies on. It does not claim an external audit; none has been performed. The contract has been reviewed internally and exercised with Foundry unit and invariant tests (`packages/contracts/test/`), which is a different and weaker claim than a third-party audit.

## Contract authorization

`CovenantEscrow` (`packages/contracts/src/CovenantEscrow.sol`) is the only component that can move the FXRP bond, and it enforces:

- **No caller-chosen beneficiary.** `settlePaid` always transfers to `commitment.payer`; `settleDefault` always transfers to `commitment.beneficiary`. Both addresses are set once, at `createCommitment`, from `msg.sender` and the supplied beneficiary; neither settlement function accepts a recipient argument.
- **Settlement is permissionless but proof-gated.** Anyone can call `settlePaid` or `settleDefault`, but the call only succeeds if the supplied FDC proof matches the commitment's own stored terms and passes `FdcVerification.verifyPayment` / `verifyReferencedPaymentNonexistence`. There is no admin key, owner, or pause function that can override this.
- **Reentrancy protection.** Both settlement functions and `createCommitment` are `nonReentrant` (OpenZeppelin `ReentrancyGuard`), and follow checks-effects-interactions: `commitment.status` is updated and the `CommitmentSettled` event is emitted before the external `safeTransfer` call.
- **Token transfer verification.** `createCommitment` and `_settle` both compare the collateral token's balance before and after each transfer and revert `UnexpectedTokenBalanceDelta` if the observed delta does not exactly match the expected amount, guarding against a nonstandard or fee-on-transfer token silently breaking accounting.
- **Constructor-time sanity checks.** The collateral token and `FdcVerification` addresses are checked for non-zero and for having deployed code, reverting `ZeroAddress` / `AddressHasNoCode` otherwise.

## Replay and double-settlement protection

- Each payment reference is computed on-chain as `keccak256(domain, chainId, address(this), msg.sender, commitmentId)` and immediately marked in `referenceUsed`; `createCommitment` reverts `PaymentReferenceCollision` on a zero or reused reference. Callers cannot supply or pre-reserve a reference.
- `_activeCommitment` requires `status == Active` before either settlement function proceeds, reverting `CommitmentNotActive` otherwise. Status is flipped to `Fulfilled` or `Defaulted` before the token transfer, so a second settlement call on the same commitment, whether from a replayed proof or a duplicate submission, always reverts rather than transferring twice.
- At the API layer, `getOrCreateFdcJob` inserts with `Prefer: resolution=ignore-duplicates` on the `(commitment_id, attestation_type)` unique key and re-selects on conflict, so repeated `prove-payment` or `prove-default` calls always resolve to the same job row instead of creating a second, conflicting one.

## Reference, recipient, amount, and timing checks

`settlePaid` rejects the proof unless all of the following match the commitment's stored terms: attestation type is `Payment`, source is `testXRP`, `receivingAddressHash` and `intendedReceivingAddressHash` equal the commitment's `xrplDestinationHash`, `receivedAmount` and `intendedReceivedAmount` are each at least the committed drops, `standardPaymentReference` equals the commitment's reference, and `blockNumber`/`blockTimestamp` fall within `[minimalLedger, deadlineLedger]` and at or before `deadlineTimestamp`.

`settleDefault` additionally requires `block.timestamp` to already be past `deadlineTimestamp` (`DefaultTooEarly` otherwise), and checks the RPN request's ledger range, deadline, destination hash, amount (committed drops minus one, matching FDC's "strictly greater than" semantics), reference, and disabled source-address checking against the commitment, plus that the response's overflow ledger and timestamp are past the deadline.

## API validation

- Every route that takes a commitment id, wallet address, status filter, result limit, or XRPL transaction hash validates the input's format before it reaches the database or an external service, returning `400` on a malformed value.
- `payment-request` takes only the XRPL destination address from the caller. The amount and payment reference are always read from the indexed on-chain commitment. The destination must hash-match the commitment's stored `recipient_xrpl_address_hash`, or the request is rejected with `400`.
- `payment-observation` independently re-fetches and re-validates the referenced XRPL transaction (type, single matching memo, destination, no partial-payment flag, no cross-currency `Paths`/`SendMax`/`DeliverMin`, sufficient delivered amount) before recording it; it never trusts the caller's description of the transaction, and it never settles anything by itself.
- `prove-payment` requires a prior validated XRPL observation for the same commitment (`400` otherwise); `prove-default` requires the deadline (and, once implemented, cure window) to have passed (`409` otherwise).
- Upstream Supabase/PostgREST failures return `502` with the cause logged server-side and never a bare `500`; a genuinely empty result set returns `200` with `[]`, so an outage can never be silently mistaken for "no commitments."

## Supabase and service-role boundary

- Row-level security is enabled on every table that holds user or commitment data (`profiles`, `wallet_link_challenges`, `commitments`, `settlement_events`, `notifications`, `audit_logs`, `indexer_checkpoints`, `xrpl_observations`, `fdc_jobs`).
- The service-role key is granted table access explicitly (see `20260814010000_service_role_grants.sql`) and is used only from the API server; it bypasses RLS by design, which is why it is never sent to the browser.
- User-facing routes (`/api/profile`, `/api/notifications`) use the caller's own Supabase access token, so Postgres RLS, not application code, enforces that a user can only read or modify their own rows.
- `profiles.is_admin` cannot be set by a client role. The first administrator must be promoted directly in Supabase; the API only checks the flag, it never sets it.

## Authentication

- Wallet identity for on-chain actions comes directly from the connected EVM wallet signing the transaction; Covenant does not separately authenticate that signer.
- Optional account features (linking a wallet to a Supabase profile, notifications) use short-lived, single-use, nonce-based challenges (`CHALLENGE_TTL_MS = 5 minutes`). Verification recomputes the signature with `viem`'s `verifyMessage` against the exact challenge message, and consumption is made atomic and replay-safe by conditioning the `consumed_at` update on both the challenge id and a matching nonce hash still being unset.
- `POST /api/indexer/sync` requires `X-Internal-API-Secret` and compares it to the configured secret using `crypto.timingSafeEqual` over SHA-256 digests of both values, avoiding both a timing side-channel and a raw string comparison.

## Secrets handling

- `.env` is git-ignored. `.env.example` documents variable names and, where a value is genuinely public (RPC URLs, the FDC verifier URL), the actual default; it never contains a real secret.
- The frontend contains no private key, no Supabase service-role key, and no internal API secret; every privileged action happens in the user's own wallet or on the server.
- The optional `COSTON2_EXECUTOR_PRIVATE_KEY` is validated for format (`^0x[0-9a-fA-F]{64}$`) before use and is expected to be a low-value, gas-only EOA. It cannot custody user FXRP or XRP and cannot redirect a settlement, since `settlePaid`/`settleDefault` compute the recipient from the commitment's own stored terms regardless of who submits the transaction. When unset, FDC jobs still prepare and poll (both read-only) and pause at submission with `error_code: "EXECUTOR_KEY_MISSING"` rather than failing the job permanently.

## Known limitations

- No external security audit has been performed on `CovenantEscrow` or the API.
- The indexed `cure_ends_at` field currently equals `deadline_at`; there is no cure window distinct from the contract's own hard deadline yet, even though the schema and the default-settlement gate are already structured to support one.
- Rate limiting on public proof-creation endpoints (`prove-payment`, `prove-default`) is not currently implemented; both are idempotent per commitment via the unique `fdc_jobs` key, which limits but does not eliminate the value of spamming them.
- Contract tests exist (`CovenantEscrow.t.sol`, `CovenantEscrow.invariant.t.sol`) but a pass/fail count is not included in this document because Foundry could not be executed in the environment this document was written in; see the README's Tests section for what was actually run.
