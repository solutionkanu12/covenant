# Phase 1B XRPL Testnet Payment

## Scope

Phase 1B proves one direct, referenced XRP payment on XRPL Testnet. It does not use mainnet or real funds, payment paths, partial payments, FDC attestations, or Phase 1C functionality.

The payer and recipient were fresh wallets funded by the XRPL Testnet faucet. Their seeds exist only in the gitignored root `.env` file and are not printed, documented, included in the fixture, or committed.

## Validated payment

- Recovered and verified at: `2026-08-11T13:31:19+01:00` (Africa/Lagos)
- Network: XRPL Testnet
- Payer: `rKQPLJHUD7x1sGu2hd37UutcZ64VbQGuZD`
- Recipient: `rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw`
- Transaction hash: `55352D2661BF420D9AA962781AB66DC63E3916887ED362DEA9B6E63C3C960BF0`
- Ledger index: `19819259`
- Delivered amount: `1,000,000` drops (`1 XRP`)
- Memo count: `1`
- MemoData: `260B7E15BA888B6D7B3CBCCA5966913CDECEC7E81FC80E4E4E3679BA079C7FE1`
- Transaction result: `tesSUCCESS`

The reference is exactly 64 hexadecimal characters, representing 32 random bytes.

## Verification

The recovery-only verifier reads the existing wallet seeds from `.env`, queries the payer's validated account history, and supports current `account_tx` response shapes, including transaction data under `tx_json` and native XRP delivered amounts represented as drops or currency/value objects.

```bash
pnpm --filter @covenant/api prove:xrpl-payment
```

The verifier confirmed:

- the transaction is validated with result `tesSUCCESS`;
- exactly `1,000,000` drops were requested and delivered to the expected recipient;
- exactly one memo exists and its `MemoData` is exactly 64 hexadecimal characters;
- `Paths`, `SendMax`, and `DeliverMin` are absent; and
- the partial-payment flag is not set.

The sanitized machine-readable result is stored at `apps/api/fixtures/phase-1b-xrpl-payment.json`. It contains no wallet seeds or other secret material.
