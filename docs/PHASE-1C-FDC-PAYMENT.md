# Phase 1C FDC Payment Proof

## Scope

Phase 1C proves the existing Phase 1B XRPL Testnet payment through Flare FDC on Coston2. It submits and verifies one `Payment` request only. It does not retrieve or submit a referenced-payment-nonexistence proof and does not begin another phase.

## FDC request

- Coston2 chain ID: `114`
- Request transaction: `0x2939b950f732b1cbdc182ad4f502e1034934d60a30947a1011e60242b8394017`
- Request block: `33937328`
- Receipt status: success
- FdcHub: `0x48aC463d7975828989331F4De43341627b9c5f1D`
- Request fee: `1000` wei
- Attestation type: `Payment`
- Source: `testXRP`
- XRPL transaction: `55352D2661BF420D9AA962781AB66DC63E3916887ED362DEA9B6E63C3C960BF0`
- `inUtxo`: `0`
- `utxo`: `0`

The confirmed `AttestationRequest(bytes,uint256)` event contains the exact verifier-produced request bytes and fee.

## Finalized proof

- Voting round: `1422765`
- FDC protocol ID: `200`
- FdcVerification: `0x906507E0B64bcD494Db73bd0459d1C667e14B933`
- XRPL ledger: `19819259`
- Received amount: `1,000,000` drops
- Intended received amount: `1,000,000` drops
- Payment reference: `260B7E15BA888B6D7B3CBCCA5966913CDECEC7E81FC80E4E4E3679BA079C7FE1`
- Payment status: success (`0`)
- One-to-one payment: `true`
- Onchain verification through `eth_call`: `true`

The decoded proof matches the Phase 1B transaction ID, payer-address hash, recipient-address hash, ledger index, delivered amount, and exact 32-byte reference. The Merkle proof and ABI-encoded response are stored in `apps/api/fixtures/phase-1c-fdc-payment.json`; they contain no wallet credentials or private data.

## Reproduce

The verifier uses the official Coston2 RPC, resolves current contracts through the Flare Contract Registry, derives the voting round from the confirmed request block, checks Relay finalization, retrieves the proof from the official Coston2 DA service, validates it against the Phase 1B fixture, and calls `FdcVerification.verifyPayment` with `eth_call` only.

```bash
pnpm --filter @covenant/api verify:fdc-payment
```

No wallet, private key, keystore password, or transaction broadcast is required to reproduce verification.
