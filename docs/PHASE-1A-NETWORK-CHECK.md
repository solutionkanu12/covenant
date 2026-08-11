# Phase 1A Network Check

## Scope

This phase verifies public, read-only connectivity only. It does not create or connect wallets, request faucet funds, use private keys, send transactions, or prepare or submit FDC attestations.

## Official endpoints

| Service                        | Tested endpoint                                                    | Official reference                                                                        |
| ------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Flare Coston2 JSON-RPC         | `https://coston2-api.flare.network/ext/C/rpc`                      | [Flare network overview](https://dev.flare.network/network/overview)                      |
| XRPL Testnet WebSocket         | `wss://s.altnet.rippletest.net:51233`                              | [XRPL public servers](https://xrpl.org/docs/tutorials/get-started/get-started-javascript) |
| Flare testnet XRP FDC verifier | `https://fdc-verifiers-testnet.flare.network/verifier/xrp/api-doc` | [Flare network API resources](https://dev.flare.network/network/overview#api-resources)   |

## Test run

- Tested at: `2026-08-11T00:24:08+01:00` (Africa/Lagos)
- Command: `pnpm --filter @covenant/api check:networks`

| Check                        | Result                     |
| ---------------------------- | -------------------------- |
| Coston2 RPC health           | Passed (`ok`)              |
| Coston2 chain ID             | `114` (expected `114`)     |
| Coston2 latest block         | `33896493`                 |
| Coston2 client version       | `v0.15.4`                  |
| XRPL Testnet RPC health      | Passed (`ok`)              |
| XRPL latest validated ledger | `19804596`                 |
| FDC verifier reachability    | Passed (`HTTP 200`)        |
| FDC verifier content type    | `text/html; charset=utf-8` |

Block and ledger numbers are observations from this test run and will advance over time.

## Result

Phase 1A passed: all three official public endpoints were reachable, Coston2 reported chain ID `114`, and XRPL Testnet returned a validated ledger index.
