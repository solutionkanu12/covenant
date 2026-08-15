# Phase 8: Frontend Foundation

Phase 8 delivers the Covenant web shell: brand, navigation, footer, wallet
connection and the shared UI primitives that Phase 9 product screens will use.

## Brand

- The Covenant mark is an open ring with a centered dot: the ring is the
  commitment, the dot is the locked FXRP bond. It ships as
  `components/brand/logo.tsx` and as the favicon in `app/icon.svg`.
- Typography is Manrope (interface and display) with JetBrains Mono for
  addresses and hashes, both self-hosted through Fontsource variable packages.
- Design tokens live in `app/globals.css` as Tailwind v4 theme values: warm
  bone paper, deep ink text, one royal blue accent, and muted status tones.
  The palette avoids pure white, gradients and glow effects.

## Shell

- `components/layout/site-nav.tsx` is a sticky translucent header
  (translucent paper background with backdrop blur) with anchor links and the
  wallet control. Small screens get a dialog based menu.
- `components/layout/site-footer.tsx` carries protocol, legal and network
  links plus the testnet disclosure. Every link resolves: anchors, the two
  legal pages, and real explorer URLs.
- `/legal/terms` and `/legal/privacy` hold short, honest copy that matches the
  PRD framing (collateralized commitment, not insurance or custody).

## Wallet and Coston2

- `lib/wagmi.ts` configures wagmi v3 for Coston2 only (chain id 114) with
  injected and Coinbase Wallet connectors. `NEXT_PUBLIC_COSTON2_RPC_URL` can
  override the public RPC endpoint.
- `components/wallet/connect-button.tsx` covers the full state machine:
  disconnected, reconnecting, connected on the wrong chain (offers a one
  click switch to Coston2), and connected (address button with an account
  dialog: copy, explorer link, disconnect).
- Wallet actions surface feedback through the toast system.

## Shared UI

`components/ui/` provides Button (variants, sizes, loading state), Field,
Input and Textarea (labels, hints, errors, aria wiring), Badge status tones,
Spinner and Skeleton, an accessible Dialog (focus trap, Escape, overlay
close, focus restore, scroll lock), a Toast provider, and a TxFeedback
element that renders the shared transaction lifecycle (`lib/tx.ts`) with
explorer links.

## Responsive and motion

- Layouts are fluid from small phones upward; the landing page and shell were
  designed mobile first.
- `prefers-reduced-motion` collapses all animations and smooth scrolling, and
  interactive elements keep a visible accent focus ring.

## Checks

- `pnpm --filter @covenant/web test` runs the util test suites (node:test).
- Root `pnpm test` now runs every workspace package that defines tests.
- Lint, typecheck and `pnpm build:web` all pass.
