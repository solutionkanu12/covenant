# Phase 6 — Safe XRPL payment flow

Phase 6 generates the exact XRP payment a payer must sign and validates any XRPL transaction
reported against a commitment, without ever asking the payer to type the payment reference.

## Payment generation

`POST /api/commitments/:id/payment-request` takes only `{ xrplDestinationAddress }`. The
destination is the one legitimate offchain input (the recipient's XRPL account, normally
collected once at commitment creation); everything else — the XRP amount and the 32-byte
payment reference — comes from the indexed onchain commitment, never from the request body.
The supplied address is hashed with Flare's standard scheme
(`keccak256(utf8Bytes(address))`) and rejected unless it matches the commitment's onchain
`xrplDestinationHash`, so a caller cannot redirect a payment to an unrelated account. Once
validated, the address is cached on the commitment row for later reuse and display.

The response always includes the exact copyable XRPL transaction JSON
(`TransactionType: "Payment"`, `Destination`, `Amount` in drops, and exactly one
`Memo.MemoData` equal to the commitment's reference). If `XAMAN_API_KEY` /
`XAMAN_API_SECRET` are configured, it also includes a Xaman payload UUID, QR PNG, and
deeplink; Xaman resolves the signing account from the connected wallet, so Covenant never
custodies XRP. When Xaman is not configured, or payload creation fails, `xaman` is `null`
and the JSON fallback remains the complete, working payment request.

## Observation and validation

`POST /api/commitments/:id/payment-observation` takes an XRPL transaction hash, looks it up
on XRPL Testnet, and structurally validates it against the commitment's authoritative terms
before anything is persisted: transaction type, exactly one memo matching the reference,
correct destination (by hash), no partial-payment flag, no cross-currency `Paths` /
`SendMax` / `DeliverMin`, and a delivered amount at least equal to the committed amount.
Invalid observations are rejected with the specific reasons and are never written to
`xrpl_observations`. A valid observation is stored as evidence only — it never settles a
commitment and is explicitly not proof of received value; only a verified FDC `Payment`
proof (Phase 7) does that, re-deriving the delivered amount independently onchain.

## Storage

`supabase/migrations/20260814020000_phase_6_xrpl_observations.sql` adds the
`xrpl_observations` table described in `docs/ARCHITECTURE.md`, publicly readable like other
evidence tables and writable only by `service_role`.
