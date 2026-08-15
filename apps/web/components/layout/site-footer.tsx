import { covenantCoston2Deployment } from "@covenant/shared";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { coston2ExplorerUrl, explorerAddressUrl } from "@/lib/chains";

const protocolLinks = [
  { href: "/vault", label: "Vault" },
  { href: "/commitments/new", label: "New commitment" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#deployment", label: "Deployment" },
];

const legalLinks = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
];

const networkLinks = [
  { href: coston2ExplorerUrl, label: "Coston2 explorer" },
  {
    href: explorerAddressUrl(covenantCoston2Deployment.covenantEscrow),
    label: "Escrow contract",
  },
  { href: "https://testnet.xrpl.org", label: "XRPL testnet explorer" },
];

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: string;
}) {
  const className =
    "text-sm text-ink-soft transition-colors duration-150 ease-out-soft hover:text-ink";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <span className="inline-flex items-center gap-2.5">
              <LogoMark className="h-6 w-6" />
              <span className="text-base font-semibold tracking-tight text-ink">
                Covenant
              </span>
            </span>
            <p className="mt-3 max-w-xs text-sm leading-6 text-ink-soft">
              Collateralized XRP payment commitments, settled by Flare data
              proofs.
            </p>
          </div>
          <nav aria-label="Protocol">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              Protocol
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {protocolLinks.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Legal">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              Legal
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Network">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              Network
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {networkLinks.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} external>
                    {link.label}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Covenant. Hackathon prototype on public testnets.</p>
          <p>Not insurance, not custody, not financial advice.</p>
        </div>
      </div>
    </footer>
  );
}
