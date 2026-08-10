# Covenant Build Pack

This folder is the source of truth for the Covenant hackathon build.

## Read in this order

1. `01-MVP-FEATURE-LIST.md`
2. `02-HACKATHON-PRD.md`
3. `03-SYSTEM-ARCHITECTURE.md`
4. `04-DEVELOPMENT-ROADMAP.md`

## Working rule

We build Covenant one phase at a time. Do not ask Codex to build the entire product in one prompt.

For every phase:

1. Open the project in VS Code.
2. Start Codex inside the project directory.
3. Paste only the prompt for the current phase.
4. Let Codex inspect the existing code before editing.
5. Run the verification commands for that phase.
6. Fix failures before continuing.
7. Commit the completed phase to Git.
8. Move to the next phase only after its gate passes.

The validation file remains authoritative for product claims and safety rules. Covenant is a collateralized XRP payment commitment, not insurance or a full payment guarantee.

## Fixed MVP outcome

The demo must show two real Coston2 artifacts:

- A fulfilled commitment where an FDC `Payment` proof returns the FXRP bond to the payer.
- A defaulted commitment where an FDC `ReferencedPaymentNonexistence` proof transfers the FXRP bond to the recipient.

Features outside that lifecycle must not delay the demo.
