import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for the Covenant testnet prototype.",
};

const sections = [
  {
    title: "What Covenant is",
    body: "Covenant is a collateralized payment commitment. A payer locks a small FXRP bond on Flare behind a promise to send XRP on XRPL by a deadline. Verified payment data decides whether the bond returns to the payer or moves to the recipient. Covenant is not insurance, not a guarantee, and not financial advice.",
  },
  {
    title: "Testnet prototype",
    body: "This deployment runs on Flare Coston2 and the XRPL testnet for the Flare Summer Signal hackathon. All assets are test assets with no real value. The software is provided as is, may change at any time, and may contain defects.",
  },
  {
    title: "No custody",
    body: "Covenant never holds your XRP and never asks for keys or seed phrases. The bond is held by the escrow contract, not by a person or company. Your wallets sign every action directly.",
  },
  {
    title: "Bond risk",
    body: "If a referenced payment does not arrive by its deadline and cure period, the contract can transfer the bond to the recipient once a Flare Data Connector proof confirms the outcome. Only create commitments you understand and intend to honor.",
  },
  {
    title: "Acceptable use",
    body: "Do not use the prototype for real value, unlawful activity, or attempts to disrupt the testnets it depends on.",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">
        Legal
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink">Terms</h1>
      <p className="mt-4 text-lg leading-8 text-ink-soft">
        Short and plain, because this is a testnet prototype.
      </p>
      <div className="mt-10 border-t border-line">
        {sections.map((section) => (
          <section key={section.title} className="border-b border-line py-7">
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              {section.title}
            </h2>
            <p className="mt-2 leading-7 text-ink-soft">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
