# Covenant

Covenant is a collateralized XRP payment commitment prototype. This repository currently contains only the Phase 0 local development foundation; wallet, network, database, and production contract integrations are intentionally not included yet.

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

## Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build:web
pnpm build:api
pnpm test:contracts
```
