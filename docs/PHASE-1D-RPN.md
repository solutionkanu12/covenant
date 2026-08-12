# Phase 1D Referenced Payment Nonexistence Proof

## Scope

Phase 1D proves through Flare FDC that the expected 1 XRP payment to the existing Phase 1B recipient did not occur on XRPL Testnet within the specified finalized interval. No later phase or additional transaction is included.

## Request

- Coston2 chain ID: `114`
- Request transaction: `0xf0d64169f5d3cdf48975b8e5d76fcf812ee721baa22e589fbbe643436fc50e93`
- Request block: `33952250`
- FdcHub fee: `1000` wei
- Attestation type: `ReferencedPaymentNonexistence`
- Source: `testXRP`
- Recipient: `rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw`
- Amount: `1,000,000` drops
- Reference: `25694FFB6D0C4C84E34B0A46098A034111BDA752785F542AF64A391D7AD2915A`
- Minimal ledger: `19830792`
- Deadline ledger: `19830793`
- Deadline timestamp: `1786485860`
- Source-address checking: disabled
- Source-address root: zero bytes32

## XRPL evidence and proof

Direct XRPL queries found zero matching payments in ledgers `19830792` through `19830793`. Ledger `19830794`, closed at Unix timestamp `1786485861`, is the first ledger whose number and timestamp exceed both deadlines.

- Voting round: `1423091`
- Lowest used timestamp: `1786485851`
- First overflow ledger: `19830794`
- FdcVerification: `0x906507E0B64bcD494Db73bd0459d1C667e14B933`
- `verifyReferencedPaymentNonexistence` through `eth_call`: `true`

The public ABI response and Merkle path are stored in `apps/api/fixtures/phase-1d-rpn.json`. The fixture contains no wallet credentials or private data.

## Reproduce

The verifier reads the confirmed request event, resolves current Coston2 contracts through the Flare Contract Registry, checks Relay finalization, fetches the official Coston2 DA proof, queries the exact XRPL ledger interval, validates every request and response field, and invokes the verification contract using a read-only call.

```bash
pnpm --filter @covenant/api verify:fdc-rpn
```

No wallet, signing key, password, or transaction broadcast is required.
