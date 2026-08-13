# Covenant System Architecture

## 1. Architecture Goal

Keep funds and settlement rules onchain while using a small backend only for asynchronous proof orchestration, XRPL observation and indexing.

```text
Browser
  |
  |-- EVM wallet ------> Flare Coston2
  |                       |-- CovenantCommitment.sol
  |                       |-- FXRP token
  |                       |-- FdcHub
  |                       `-- FdcVerification
  |
  |-- Xaman wallet -----> XRPL Testnet
  |
  `-- HTTPS ------------> Covenant API and executor
                          |-- XRPL RPC
                          |-- FDC verifier
                          |-- FDC Data Availability API
                          `-- Supabase PostgreSQL
```

## 2. Frontend

### Stack

- Next.js with React and TypeScript.
- Tailwind CSS with Covenant design tokens.
- `wagmi` and `viem` for EVM wallet and contract calls.
- `xrpl.js` types and helpers for XRPL payload validation.
- TanStack Query for API and async-job state.

### Main routes

- `/` — product landing page.
- `/vault` — wallet commitments and summary.
- `/commitments/new` — guided creation flow.
- `/commitments/[id]` — terms, payment action, proof progress and evidence.
- `/legal/terms` and `/legal/privacy` — footer legal pages.

### Frontend responsibilities

- Connect the wallet and enforce Coston2.
- Validate user input before contract calls.
- Request FXRP approval and commitment creation.
- Render the contract's authoritative state.
- Present the generated Xaman QR/deeplink.
- Start proof jobs and poll their status.
- Show explorer-backed evidence.

The frontend must never contain executor keys, database service keys or private API secrets.

## 3. Smart Contract

### Contract

`CovenantCommitment.sol`

### Suggested state

```solidity
enum Status { Active, Fulfilled, Defaulted }

struct Commitment {
    address payer;
    address recipient;
    bytes32 recipientXrplAddressHash;
    uint256 xrpAmountDrops;
    uint256 fxrpBondAmount;
    uint256 startXrplLedger;
    uint64 deadlineAt;
    uint64 cureEndsAt;
    bytes32 paymentReference;
    Status status;
}
```

Keep the raw XRPL address in contract events and the database if storing it onchain is unnecessary. The contract verifies its canonical hash.

### Reference generation

```solidity
bytes32 reference = keccak256(
    abi.encode(
        keccak256("CovenantEscrow.paymentReference.v1"),
        block.chainid,
        address(this),
        msg.sender,
        commitmentId
    )
);
```

This binds the reference to one payer, commitment, chain, and deployment. Callers cannot supply or
reserve references. On XRPL the generated 32 bytes are used unchanged as the sole Memo's MemoData,
which is Flare's standard XRPL payment-reference format.

### Core functions

```solidity
createCommitment(...) returns (uint256 commitmentId, bytes32 paymentReference)
settlePaid(uint256 commitmentId, Payment.Proof calldata proof)
settleDefault(uint256 commitmentId, ReferencedPaymentNonexistence.Proof calldata proof)
getCommitment(uint256 commitmentId)
```

### Contract invariants

- A commitment can settle only once.
- The contract always holds enough FXRP for every active bond.
- Only a verified matching proof can settle a commitment.
- Paid settlement sends the bond only to the recorded payer.
- Default settlement sends the bond only to the recorded recipient.
- Proof submitters never choose the beneficiary.
- Default settlement cannot occur before `cureEndsAt`.
- Received XRP amount is checked from attested payment data.

### Libraries and security

- Solidity version supported by the current Flare toolchain.
- OpenZeppelin `SafeERC20`.
- OpenZeppelin `ReentrancyGuard`.
- Checks-effects-interactions.
- Custom errors for predictable reverts.
- Foundry unit, fuzz and integration tests.

Resolve FDC and FXRP addresses from Flare's current deployment information or Contract Registry rather than copying unverified addresses.

## 4. Backend and Executor

### Stack

- Node.js and TypeScript.
- Fastify or a small standalone Next-compatible API service.
- `viem` for Flare RPC and executor transactions.
- `xrpl.js` for XRPL Testnet.
- PostgreSQL client or Supabase SDK.
- Structured logging.

### Responsibilities

- Index Covenant contract events.
- Read the validated XRPL ledger at commitment creation.
- Generate an exact XRPL Payment payload.
- Observe and validate XRPL transactions.
- Prepare and submit FDC requests.
- Store the request bytes and FDC round ID.
- Poll round finalization without blocking an HTTP request.
- Retrieve the proof from the Data Availability layer.
- Submit the proof to Covenant.
- Retry recoverable failures safely.

### Executor key

The backend may hold a low-value Coston2 executor key funded only for gas. It never holds user XRP or FXRP and cannot redirect settlement funds.

### FDC job state machine

```text
QUEUED
  -> PREPARED
  -> SUBMITTED
  -> WAITING_FOR_ROUND
  -> PROOF_READY
  -> SETTLEMENT_SUBMITTED
  -> SETTLED

Any state -> RETRYABLE_ERROR or FAILED
```

Jobs must resume from their last completed state after a restart.

## 5. Database

### Provider

Supabase PostgreSQL.

### Purpose

- Searchable projection of contract events.
- FDC job persistence.
- XRPL observation cache.
- Demo reliability and diagnostics.

The database must never override a contract status. Re-indexing from chain events should reconstruct public product state.

### Tables

- `commitments`
- `fdc_jobs`
- `xrpl_observations`
- `indexer_checkpoints`

`indexer_checkpoints` stores the last processed Flare block and prevents missed or duplicated events.

## 6. Authentication

### MVP model

- Wallet-native identity.
- Nonce-based EVM signature for an optional short-lived API session.
- Xaman signs XRP transactions independently.
- Public read endpoints need no login.
- Contract settlement is permissionless and proof-gated.

### API protection

- Validate request bodies with schemas.
- Rate-limit proof creation endpoints.
- Use idempotency keys.
- Confirm the requested commitment exists onchain.
- Restrict internal indexer routes with a server secret.

## 7. API Boundaries

### Browser to Covenant API

- Read indexed commitments.
- Generate the safe XRPL payment request.
- Start or resume a proof job.
- Poll job progress.

### Executor to Flare

- Read Covenant state.
- Submit FDC attestation requests through FdcHub.
- Submit complete proofs to Covenant.

### Executor to XRPL

- Read validated ledgers.
- Look up transactions.
- Determine the ledger corresponding to a deadline.

### Executor to FDC services

- Prepare attestation requests.
- Retrieve finalized proof data.

## 8. Deployment

### Environments

| Layer            | Development           | Hackathon deployment          |
| ---------------- | --------------------- | ----------------------------- |
| Frontend         | Local Next.js         | Cloudflare Pages              |
| Backend          | Local Node.js         | Render web service and worker |
| Database         | Local or Supabase dev | Supabase PostgreSQL           |
| Contracts        | Anvil and mocks       | Flare Coston2                 |
| External payment | XRPL Testnet          | XRPL Testnet                  |

### CI/CD

GitHub Actions should run:

1. Formatting and linting.
2. Type checking.
3. Frontend and backend tests.
4. Foundry contract tests.
5. Production builds.

Deployment should occur only after these checks pass.

### Secrets

Store only in Render, Supabase or GitHub encrypted environments:

- Executor private key.
- FDC API credentials if required.
- Xaman API credentials if used.
- Supabase service-role key.
- Internal API secret.

Commit `.env.example` with variable names and descriptions, never real values.

## 9. Repository Layout

```text
covenant/
  apps/
    web/
    api/
  packages/
    contracts/
    shared/
  docs/
  scripts/
  .github/workflows/
  .env.example
  README.md
```

Use a monorepo so the frontend, executor and contracts share types without duplicating the entire codebase.

## 10. Failure Handling

- If an FDC round is still pending, show progress and continue polling later.
- If the executor restarts, resume the stored job.
- If settlement was already submitted, inspect the transaction before retrying.
- If Xaman integration fails, expose the exact copyable XRPL transaction JSON.
- If the public FDC service is rate-limited, queue the job and display the delay.
- If test FXRP becomes unavailable, stop and evaluate the validated native-token fallback before changing scope.
