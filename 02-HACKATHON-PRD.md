# Covenant Hackathon PRD

## 1. Product Summary

Covenant is a collateralized XRP payment commitment protocol. A payer promises to send XRP to a recipient by a deadline and locks a smaller FXRP bond on Flare. The XRP payment remains on XRPL. Flare Data Connector evidence determines whether the bond returns to the payer or transfers to the recipient.

This differs from XRPL escrow because Covenant does not require the payer to pre-fund the entire XRP payment. It secures a future external payment with fractional collateral and produces verifiable settlement evidence.

## 2. Hackathon Track

- Event: Flare Summer Signal
- Bounty: Interoperable Asset Products
- Network: Flare Coston2 and XRPL Testnet
- Core Flare integrations: FXRP, FDC `Payment`, FDC `ReferencedPaymentNonexistence`

## 3. Goal

Deliver a working end-to-end prototype proving that Flare can enforce a collateral consequence for an XRP payment made or missed on XRPL.

## 4. Target Users

- Freelancers accepting XRP from clients.
- Suppliers expecting future XRP payments.
- OTC counterparties.
- DAOs and Web3 service providers.

## 5. Product Principles

- The blockchain is the source of truth.
- XRP is never held by Covenant.
- The bond is not represented as the full payment.
- Users never manually type payment references.
- Proof submission may be automated, but settlement correctness is enforced onchain.
- Every demo claim must link to inspectable evidence.

## 6. User Stories

### Payer

- As a payer, I can define a future XRP payment and lock an FXRP bond.
- As a payer, I can receive an exact XRPL payment request that prevents reference mistakes.
- As a payer, I can sign the XRP payment in Xaman without giving Covenant custody.
- As a payer, I can recover my bond after Flare verifies that I paid correctly and on time.

### Recipient

- As a recipient, I can inspect the commitment and confirm that its bond is locked.
- As a recipient, I can see the XRP amount, deadline and bond before relying on the promise.
- As a recipient, I can receive the bond after Flare proves the referenced payment did not arrive.

### Judge or public viewer

- As a judge, I can inspect fulfilled and defaulted commitments without connecting a wallet.
- As a judge, I can follow explorer links to the contract, transactions and evidence.
- As a judge, I can understand why FDC and FXRP are necessary to the product.

### Executor

- As an executor, I can request and retrieve FDC proofs and submit them to the contract.
- As an executor, I cannot redirect collateral because the contract calculates the valid recipient.

## 7. Functional Requirements

### Commitment creation

The payer supplies:

- Recipient Flare address.
- Recipient XRPL address.
- XRP amount.
- FXRP bond amount.
- Payment deadline.
- Cure period.

The system must:

- Validate addresses and positive amounts.
- Capture a validated XRPL starting ledger.
- Approve and transfer FXRP into the contract.
- Create a unique commitment ID and payment reference.
- Store critical terms onchain.

### Payment request

The system must generate a direct XRP Payment containing:

- The exact recipient XRPL address.
- The exact XRP amount in drops.
- Exactly one memo.
- A `MemoData` value equal to the commitment's 32-byte reference.

### Fulfilled settlement

The FDC `Payment` proof must establish:

- XRP or testXRP is the source chain.
- The payment reached the committed destination.
- The actual received amount is at least the promised amount.
- The standard payment reference matches the commitment.
- The payment was finalized by the agreed deadline.

If valid, the contract returns the full bond to the payer and permanently finalizes the commitment.

### Default settlement

Default settlement can begin only after the deadline and cure period. The nonexistence proof must cover the correct:

- XRPL ledger interval.
- Deadline timestamp.
- Destination address hash.
- Minimum payment amount.
- Standard payment reference.

If valid, the contract transfers the bond to the recipient and permanently finalizes the commitment.

### Rejected operations

The contract must reject:

- A reused proof or second settlement.
- An incorrect reference.
- An incorrect destination.
- An insufficient received amount.
- A payment made after the deadline.
- A default attempt before the deadline and cure period.
- A proof for an unsupported source chain.
- Invalid or unverified FDC proof data.

## 8. User Flow

### Creation

1. User connects a Flare wallet.
2. App confirms Coston2 and available FXRP.
3. User enters commitment terms.
4. App validates the XRPL and Flare addresses.
5. User approves FXRP.
6. User signs the create transaction.
7. App opens the new commitment page.

### Pay and fulfill

1. Payer opens the commitment.
2. App displays the generated Xaman QR or deeplink.
3. Payer signs the XRP payment.
4. App detects or receives the validated transaction.
5. Executor requests an FDC `Payment` proof.
6. UI displays the proof-job progress.
7. Executor submits the proof to Covenant.
8. Contract returns the bond and marks the commitment fulfilled.

### Miss and default

1. Deadline and cure period expire.
2. Recipient or executor starts default verification.
3. Executor resolves the validated XRPL deadline ledger.
4. Executor requests the nonexistence proof.
5. UI displays the proof-job progress.
6. Executor submits the proof to Covenant.
7. Contract transfers the bond and marks the commitment defaulted.

## 9. Data Requirements

Onchain state is authoritative. PostgreSQL stores searchable projections and asynchronous jobs.

### `commitments`

- `chain_id`
- `contract_address`
- `commitment_id`
- `payer_flare_address`
- `recipient_flare_address`
- `recipient_xrpl_address`
- `recipient_xrpl_address_hash`
- `xrp_amount_drops`
- `fxrp_bond_amount`
- `payment_reference`
- `start_xrpl_ledger`
- `deadline_at`
- `cure_ends_at`
- `status`
- `create_tx_hash`
- `settlement_tx_hash`
- `created_at`
- `updated_at`

Unique key: `chain_id + contract_address + commitment_id`.

### `fdc_jobs`

- `id`
- `commitment_id`
- `attestation_type`
- `request_bytes`
- `round_id`
- `status`
- `attempt_count`
- `proof_json`
- `settlement_tx_hash`
- `error_code`
- `error_message`
- `created_at`
- `updated_at`

Unique key: `commitment_id + attestation_type`. Requests must be idempotent.

### `xrpl_observations`

- `commitment_id`
- `transaction_hash`
- `ledger_index`
- `validated`
- `destination`
- `delivered_amount_drops`
- `payment_reference`
- `observed_at`

## 10. APIs

### Covenant API

| Method | Route                                  | Purpose                                  |
| ------ | -------------------------------------- | ---------------------------------------- |
| `GET`  | `/api/commitments`                     | List indexed commitments                 |
| `GET`  | `/api/commitments/:id`                 | Return terms, status and evidence        |
| `POST` | `/api/commitments/:id/payment-request` | Generate the safe XRPL payment payload   |
| `POST` | `/api/commitments/:id/prove-payment`   | Start or resume a Payment proof job      |
| `POST` | `/api/commitments/:id/prove-default`   | Start or resume a nonexistence proof job |
| `GET`  | `/api/fdc/jobs/:id`                    | Return proof-job progress                |
| `POST` | `/api/indexer/sync`                    | Internal event-indexing trigger          |

### External services

- Flare Coston2 JSON-RPC.
- Flare Contract Registry.
- FdcHub and FdcVerification contracts.
- FDC verifier API.
- FDC Data Availability API.
- XRPL Testnet WebSocket or JSON-RPC.
- Xaman payload API or compatible deeplink.

## 11. Authentication and Authorization

- No email/password accounts in the MVP.
- EVM wallet connection identifies the Flare user.
- Protected offchain actions use a short-lived wallet-signature session or signed request.
- Xaman separately authorizes the XRP payment.
- Public commitment and evidence reads require no authentication.
- Settlement functions remain permissionless because proof validation determines the outcome.
- Rate limiting protects public proof-job endpoints.

## 12. Non-Functional Requirements

- Mobile and desktop responsive.
- Clear loading state for FDC's asynchronous process.
- No private keys or API secrets in frontend code.
- Contract uses checks-effects-interactions, `SafeERC20` and reentrancy protection.
- API operations are retryable and idempotent.
- Errors are written in plain language and preserve diagnostic details for developers.
- Accessibility target: keyboard navigation, visible focus, readable contrast and reduced-motion support.

## 13. Success Criteria

- Covenant is deployed and verified on Coston2.
- FXRP is visibly locked in a real commitment.
- A real FDC `Payment` proof returns a bond to the payer.
- A real nonexistence proof transfers a bond to the recipient.
- Wrong-reference, wrong-destination, underpayment, replay and early-default tests pass.
- The UI links to the relevant Coston2 and XRPL transactions.
- Two resolved commitments are ready before the judging demo.
- A judge can understand the product and inspect both outcomes in under three minutes.
- The repository documents the selected bounty, target user, Flare usage, new work, contract addresses, setup, demo and roadmap.

## 14. Demo Narrative

1. Explain the problem: future XRP payments require either trust or complete prefunding.
2. Create a commitment and show the FXRP bond entering Covenant.
3. Show the generated XRP payment with its protected reference.
4. Open the pre-settled fulfilled example and show the bond return.
5. Open the pre-settled default example and show the bond transfer.
6. Show the FDC proof and explorer links.
7. Close with the distinction: XRP stays on XRPL while Flare enforces the collateral consequence.
