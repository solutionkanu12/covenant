# Covenant

Covenant is a collateralized XRP payment commitment prototype. The repository contains the Phase 0 foundation and Phase 1A read-only network diagnostics; wallets, transactions, attestations, databases, and production contracts are intentionally not included yet.

## Prerequisites

- Node.js 20 or newer
- pnpm 10.15.0
- Foundry (`forge`)

## Workspace

- `apps/web` — minimal Next.js App Router application with Tailwind CSS
- `apps/api` — minimal Fastify API with `GET /health`
- `packages/shared` — shared TypeScript package
- `packages/contracts` — Foundry sample contract and test

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm --filter @covenant/web dev
pnpm --filter @covenant/api dev
```

The web app defaults to `http://localhost:3000`. The API defaults to `http://localhost:3001`; its health endpoint is `GET /health`.

## Read-only network checks

The checks use the public defaults documented in `.env.example`. Override them with environment variables when needed.

```bash
pnpm --filter @covenant/api check:networks
```

## Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build:web
pnpm build:api
pnpm test:contracts
```
