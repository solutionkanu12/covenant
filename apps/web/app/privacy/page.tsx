import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy notes for the Covenant testnet prototype.",
};

const sections = [
  {
    title: "What the app stores",
    body: "Covenant indexes public blockchain events and the commitments you create, including wallet addresses, amounts, references and transaction hashes. This information already exists on public testnets.",
  },
  {
    title: "What the app never sees",
    body: "Covenant never receives private keys, seed phrases or wallet signatures beyond the transactions you choose to send. Signing happens inside your own wallet software.",
  },
  {
    title: "Cookies and tracking",
    body: "The prototype sets no tracking cookies and runs no analytics. Your wallet address is used only to show your own commitments while your wallet is connected.",
  },
  {
    title: "Public data",
    body: "Anything written to a public blockchain is visible to anyone, forever. Do not create testnet commitments that link addresses you want to keep separate.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">
        Legal
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink">
        Privacy Policy
      </h1>
      <p className="mt-4 text-lg leading-8 text-ink-soft">
        Covenant is wallet native. There is very little to say, and that is
        deliberate.
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
