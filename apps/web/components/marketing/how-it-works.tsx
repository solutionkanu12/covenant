const steps = [
  {
    number: "01",
    title: "Define the commitment",
    body: "Set the recipient, XRP amount, bond, and deadline. This is the promise the rest of the flow will prove.",
  },
  {
    number: "02",
    title: "Lock the FXRP bond",
    body: "A small FXRP bond locks in the Covenant escrow on Coston2. Covenant never holds the XRP itself.",
  },
  {
    number: "03",
    title: "Pay on XRPL",
    body: "Sign the exact payment in your own XRP wallet. The reference is attached for you, never typed by hand.",
  },
  {
    number: "04",
    title: "Let Flare settle it",
    body: "A Flare Data Connector proof returns the bond to the payer, or releases it to the recipient if the payment never arrives.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24"
    >
      <h2 className="text-3xl font-bold tracking-tight text-balance text-ink">
        How it works
      </h2>
      <p className="mt-3 max-w-2xl text-lg leading-8 text-pretty text-ink-soft">
        Four steps from a locked bond to a settled promise.
      </p>
      <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {steps.map((step) => (
          <li
            key={step.number}
            className="min-w-0 rounded-lg border border-line bg-raised p-6"
          >
            <span
              aria-hidden="true"
              className="font-mono text-sm font-semibold text-accent"
            >
              {step.number}
            </span>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">
              {step.title}
            </h3>
            <p className="mt-2 leading-7 text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
