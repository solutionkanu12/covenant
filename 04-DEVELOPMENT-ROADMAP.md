# Covenant Ordered Development Roadmap

## How We Will Use This Roadmap

Each phase gets one short, direct Codex prompt. Codex must inspect the existing repository, implement only the named phase, run its checks and summarize changed files. We do not move forward while the phase gate is failing.

## Phase 0 — Local Setup

1. Create the Covenant monorepo.
2. Add `apps/web`, `apps/api`, `packages/contracts` and `packages/shared`.
3. Configure Node.js, pnpm, TypeScript, Foundry, formatting and linting.
4. Add `.env.example`, `.gitignore` and a minimal README.
5. Initialize Git and make the foundation commit.

Gate:

- Web and API development servers start.
- A sample contract compiles and its sample test passes.
- No secret or generated build folder is tracked.

## Phase 1 — Prove the High-Risk Flare Seams

6. Configure Coston2 and confirm wallet connectivity.
7. Obtain C2FLR and test FXRP.
8. Send a direct testXRP payment containing one exact 32-byte memo reference.
9. Prepare and complete one FDC `Payment` attestation.
10. Prepare and complete one `ReferencedPaymentNonexistence` attestation using a short safe test window.
11. Save sanitized request, response and proof examples as test fixtures.
12. Document the exact start-ledger and deadline-ledger calculation.

Gate:

- Both real testXRP attestation types complete successfully.
- FXRP can be transferred on Coston2.
- The memo, amount and deadline formats are documented from observed results.

Stop condition:

Do not build the production contract until this gate passes. If a seam fails, diagnose it before changing the product.

## Phase 2 — Contract Specification and Tests

13. Define commitment fields, statuses, events, errors and invariants.
14. Create mock FXRP and mock FDC verification contracts.
15. Write failing tests for creation, fulfilled settlement and default settlement.
16. Write failing rejection tests for wrong reference, destination, amount and source chain.
17. Write failing tests for replay, double settlement, late payment and early default.

Gate:

- The contract interface and expected behavior are fixed in tests.
- Every security-sensitive edge case has a named test.

## Phase 3 — Core Smart Contract

18. Implement FXRP approval and bond locking.
19. Implement unique commitment IDs and references.
20. Implement `settlePaid` with FDC proof verification.
21. Implement `settleDefault` with FDC proof verification.
22. Add reentrancy protection, safe transfers and checks-effects-interactions.
23. Run unit, fuzz and invariant tests.
24. Review storage, events and revert messages.

Gate:

- All contract tests pass.
- Coverage includes both settlement paths and every rejection case.
- No function allows a caller to choose the settlement beneficiary.

## Phase 4 — Coston2 Contract Deployment

25. Create the Coston2 deployment script.
26. Resolve and verify current FXRP and FDC dependencies.
27. Deploy Covenant to Coston2.
28. Verify the contract and save the address, ABI, block and transaction hash.
29. Run a small real FXRP deposit test.

Gate:

- The verified contract is visible in the Coston2 explorer.
- The frontend-ready ABI and deployment metadata are committed.

## Phase 5 — Backend Foundation

30. Create typed configuration and environment validation.
31. Connect the API to Coston2, XRPL Testnet and Supabase.
32. Create database migrations for commitments, FDC jobs, XRPL observations and indexer checkpoints.
33. Implement structured logging and health checks.
34. Implement the Covenant event indexer.

Gate:

- API health reports each dependency separately.
- Contract events appear correctly in the database.
- Restarting the indexer neither misses nor duplicates records.

## Phase 6 — Safe XRPL Payment Flow

35. Build the commitment-bound XRPL Payment generator.
36. Enforce exact destination, drops amount and one 32-byte memo.
37. Add Xaman payload and QR generation.
38. Add copyable transaction JSON fallback.
39. Add XRPL transaction observation and validation.
40. Test omitted, duplicated and incorrect memo cases.

Gate:

- A payer can open and sign the correctly referenced payment.
- The system never asks the payer to type the reference.
- Invalid payment payloads are rejected before proof creation.

## Phase 7 — FDC Executor

41. Implement the persisted FDC job state machine.
42. Implement Payment request preparation and submission.
43. Implement nonexistence request preparation and submission.
44. Poll rounds and retrieve proofs from the Data Availability layer.
45. Submit proofs to the Covenant contract.
46. Add retries, idempotency and restart recovery.
47. Expose proof-start and job-status API routes.

Gate:

- Both proof paths settle real Coston2 commitments.
- Repeating an API request does not create conflicting jobs or double settlement.
- A worker restart does not lose an active proof job.

## Phase 8 — Frontend Foundation

48. Apply the approved Covenant tokens, typography, logo and favicon.
49. Build the static translucent navigation and complete footer.
50. Add wallet connection and Coston2 network handling.
51. Add shared buttons, inputs, status elements, dialogs and transaction feedback.
52. Add reduced-motion and responsive behavior.

Gate:

- The shell matches the approved prototype on desktop and mobile.
- Keyboard focus and loading states work.
- No gradients, pure white, glow effects, emoji or generic three-column feature grid are introduced.

## Phase 9 — Product Screens

53. Build the main vault with real indexed commitments.
54. Build the commitment creation flow.
55. Build FXRP approval and create-transaction states.
56. Build the commitment detail and evidence view.
57. Add Xaman QR/deeplink and JSON fallback.
58. Add FDC progress, fulfilled and defaulted states.
59. Add real explorer links and empty/error states.

Gate:

- No production screen depends on hard-coded commitment data.
- The complete user journey works from the deployed frontend.

## Phase 10 — End-to-End Proof

60. Run and record a complete fulfilled commitment.
61. Run and record a complete defaulted commitment.
62. Preserve both commitments for the judge demo.
63. Test wrong reference, underpayment, late payment and early default against the deployed system.
64. Fix integration errors and improve plain-language feedback.

Gate:

- Both permanent judge artifacts show real FXRP movement and FDC-backed settlement.
- Every demo link opens correctly.

## Phase 11 — Security and Quality Review

65. Review contract authorization, settlement invariants and token transfers.
66. Review API validation, rate limits, secrets and idempotency.
67. Run linting, type checking, tests and production builds.
68. Test mobile layouts, keyboard navigation and reduced motion.
69. Remove dead code, mock labels and unused dependencies.

Gate:

- All automated checks pass from a clean checkout.
- No secret, private key or misleading product claim appears in the repository.

## Phase 12 — Deployment and Submission

70. Deploy the frontend to Cloudflare Pages.
71. Deploy the API and worker to Render.
72. Apply Supabase production migrations and security settings.
73. Complete the README, architecture, contract-address and provenance documents.
74. Write and rehearse a demo under three minutes.
75. Record the video using the two settled examples.
76. Complete every DoraHacks submission field and verify public links.
77. Freeze the submission commit and tag it.

Final gate:

- Live app, repository, video, contracts and evidence are publicly accessible.
- The submission clearly explains why FDC and FXRP are essential.
- The product is described as a collateralized payment commitment, not insurance or a full guarantee.

## Codex Prompt Format We Will Follow

Every phase prompt should contain only:

1. The current phase objective.
2. The exact in-scope tasks.
3. Relevant files or documents to read first.
4. Constraints that affect this phase.
5. Commands or tests Codex must run.
6. The gate that must pass.
7. A rule not to start later phases.

I will provide these prompts one phase at a time after the repository is opened in VS Code.
