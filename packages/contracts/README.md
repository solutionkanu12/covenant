# Covenant escrow deployment constraints

`CovenantEscrow` is supported only on Coston2 (chain ID `114`) with the official,
non-rebasing FTestXRP token and the current official `FdcVerification` address returned by the
Flare contract registry. Negative-rebasing tokens and arbitrary ERC20 contracts are unsupported:
the escrow deliberately fails closed if its balance no longer covers active commitments, which
preserves funds but can prevent settlement.

Before deployment, set `COVENANT_COLLATERAL_TOKEN` and `COVENANT_FDC_VERIFICATION` to the intended
constructor arguments and run:

```sh
pnpm --filter @covenant/api preflight:escrow
```

The preflight requires chain ID `114`, the official Coston2 FTestXRP address
`0x0b6A3645c240605887a5532109323A3E12273dc7`, deployed code at both addresses, and an FDC verifier
equal to the current value resolved from Flare's official contract registry.

`createCommitment` returns `(commitmentId, paymentReference)` and also emits the reference in
`CommitmentCreated`. For XRPL, submit that reference unchanged as the `MemoData` of the
transaction's sole `Memo`. Flare defines a standard XRPL payment reference as exactly one Memo
whose MemoData is exactly 32 bytes.
