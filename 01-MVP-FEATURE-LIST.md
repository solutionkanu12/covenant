# Covenant MVP Feature List

## Product sentence

Promise an XRP payment, back it with an FXRP bond, and Flare automatically pays the recipient the bond if it can prove the payment never arrived.

## Must Have

### Wallet and network

- Connect an EVM wallet to Flare Coston2.
- Detect and request switching to Coston2, chain ID `114`.
- Display C2FLR and FXRP balances.
- Link addresses and transactions to the Coston2 explorer.

### Create a commitment

- Collect the payer's Flare address from the connected wallet.
- Collect the recipient's Flare address and XRPL address.
- Set the promised XRP amount in drops.
- Set the FXRP bond amount.
- Set the XRP payment deadline and cure period.
- Record the starting validated XRPL ledger.
- Approve and lock FXRP in the Covenant contract.
- Emit a commitment ID and unique 32-byte payment reference.

### Safe XRP payment request

- Derive the reference from the chain ID, contract address and commitment ID.
- Generate a direct XRP Payment transaction.
- Prefill the correct destination, exact amount and exactly one 32-byte `MemoData` reference.
- Provide a Xaman QR or deeplink.
- Provide copyable XRPL transaction JSON as a fallback.
- Never ask the user to type the reference manually.

### Fulfilled path

- Allow the payer or executor to request an FDC `Payment` attestation.
- Track the asynchronous FDC job and round.
- Verify the proof onchain.
- Require the correct source chain, destination, reference and received amount.
- Require payment at or before the agreed deadline.
- Return the FXRP bond to the payer.
- Mark the commitment `Fulfilled`.

### Default path

- Disable default settlement before the deadline and cure period expire.
- Determine the validated XRPL deadline ledger.
- Request an FDC `ReferencedPaymentNonexistence` attestation.
- Verify destination, reference, promised amount, start ledger and deadline data.
- Transfer the FXRP bond to the recipient.
- Mark the commitment `Defaulted`.

### Evidence and demo

- Show commitment terms, status, timeline and settlement result.
- Show Flare transaction, FDC round and XRPL transaction links where applicable.
- Show clear pending, fulfilled, defaulted and failed states.
- Pre-create one real fulfilled commitment and one real defaulted commitment.
- Include contract tests for the main paths and rejected edge cases.
- Publish deployment addresses, setup instructions and demo steps.

## Nice to Have

- Recipient acceptance before activation.
- Automatic detection of the signed XRPL payment.
- Manual transaction-hash fallback.
- Browser notifications when proof settlement completes.
- Search and filter commitments.
- Shareable public commitment pages.
- Downloadable proof receipt.
- Automatic FXRP approval and creation as one guided flow.
- Basic wallet activity statistics without a reputation score.

## Future Features

- Flare mainnet deployment.
- Dynamic bond ratios based on deal terms.
- Recurring and milestone commitments.
- Support for additional XRPL assets and external chains.
- Third-party bond providers and underwriting pools.
- Configurable dispute and grace-period policies.
- Sybil-resistant payment history.
- Merchant API and Covenant SDK.
- Flare Smart Account automation.
- Private deal metadata with selective disclosure.

## Explicitly Out of Scope for the MVP

- Full payment insurance or reimbursement.
- A credit score or trust score.
- Fiat conversion.
- Custody of the XRP payment.
- A marketplace for lenders or underwriters.
- Multiple smart contracts when one core contract is sufficient.
