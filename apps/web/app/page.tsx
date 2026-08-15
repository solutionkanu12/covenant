import { covenantCoston2Deployment } from "@covenant/shared";

import { buttonClasses } from "@/components/ui/button";
import { ConnectButton } from "@/components/wallet/connect-button";
import { explorerAddressUrl } from "@/lib/chains";

const facts = [
  {
    title: "Bond on Flare",
    body: "A small FXRP bond locks in the escrow contract on Coston2.",
  },
  {
    title: "Payment on XRPL",
    body: "The XRP itself moves only on XRPL. Covenant never holds it.",
  },
  {
    title: "Proof decides",
    body: "Flare Data Connector evidence sends the bond to the right side.",
  },
];

const steps = [
  {
    number: "01",
    title: "Define the commitment",
    body: "Set the recipient, XRP amount, bond and deadline. The FXRP bond locks in the Covenant contract on Coston2.",
  },
  {
    number: "02",
    title: "Pay on XRPL",
    body: "Sign the exact payment in your own XRP wallet. The reference is attached for you, never typed by hand.",
  },
  {
    number: "03",
    title: "Let Flare settle it",
    body: "A Flare Data Connector proof returns the bond to the payer, or releases it to the recipient if the payment never arrives.",
  },
];

const deploymentRows = [
  {
    label: "Escrow contract",
    value: covenantCoston2Deployment.covenantEscrow,
  },
  {
    label: "FXRP collateral token",
    value: covenantCoston2Deployment.collateralToken,
  },
  {
    label: "FDC verification",
    value: covenantCoston2Deployment.fdcVerification,
  },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-accent"
            />
            Built on Flare and XRPL
          </p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance text-ink sm:text-5xl md:text-6xl">
            Say you will pay. Then prove it.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-pretty text-ink-soft">
            Lock a small FXRP bond behind a future XRP payment. Flare proofs
            return the bond when you pay, or send it to the recipient if you do
            not.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ConnectButton size="md" />
            <a
              href={explorerAddressUrl(
                covenantCoston2Deployment.covenantEscrow,
              )}
              target="_blank"
              rel="noreferrer"
              className={buttonClasses({ variant: "ghost", size: "md" })}
            >
              View the escrow contract
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  d="M5 15L15 5M8 5h7v7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <dl className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface sm:flex-row sm:divide-x sm:divide-y-0">
          {facts.map((fact) => (
            <div key={fact.title} className="flex-1 p-6">
              <dt className="text-sm font-semibold text-ink">{fact.title}</dt>
              <dd className="mt-1.5 text-sm leading-6 text-ink-soft">
                {fact.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-20 sm:px-6"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">
            Three steps, one enforceable promise
          </h2>
        </div>
        <ol className="mt-10 border-t border-line">
          {steps.map((step) => (
            <li
              key={step.number}
              className="grid gap-2 border-b border-line py-8 sm:grid-cols-[6rem_1fr] sm:gap-6"
            >
              <span
                aria-hidden="true"
                className="font-mono text-sm font-semibold text-accent"
              >
                {step.number}
              </span>
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 leading-7 text-ink-soft">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="deployment"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6"
      >
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted uppercase">
                Deployment
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">
                Live on Coston2
              </h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3.5 py-1.5 text-xs font-semibold text-success">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-success"
              />
              Chain {covenantCoston2Deployment.chainId}
            </span>
          </div>
          <dl className="mt-8 border-t border-line">
            {deploymentRows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-1 border-b border-line py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <dt className="text-sm font-semibold text-ink-soft">
                  {row.label}
                </dt>
                <dd className="flex items-center gap-3">
                  <span className="font-mono text-sm break-all text-ink">
                    {row.value}
                  </span>
                  <a
                    href={explorerAddressUrl(row.value)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${row.label} on the Coston2 explorer`}
                    className="shrink-0 text-sm font-semibold text-accent hover:text-accent-strong"
                  >
                    View
                  </a>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm leading-6 text-muted">
            Public testnet deployment built for the Flare Summer Signal
            hackathon. Value shown here is test value only.
          </p>
        </div>
      </section>
    </>
  );
}
