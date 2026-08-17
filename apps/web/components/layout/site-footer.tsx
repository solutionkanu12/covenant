import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";

const productLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#deployment", label: "Deployment" },
  { href: "/vault", label: "Vault" },
];

const legalLinks = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
];

const socialLinks = [
  {
    href: "https://github.com/solutionkanu12/covenant",
    label: "GitHub",
    icon: GitHubIcon,
  },
  {
    href: "https://x.com/solution_o1",
    label: "X",
    icon: XIcon,
  },
  {
    href: "mailto:solutionkanu64@gmail.com",
    label: "Email",
    icon: MailIcon,
  },
];

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.7.12 2.5.34 1.9-1.32 2.74-1.05 2.74-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.58 5.06.36.32.68.95.68 1.92 0 1.38-.01 2.49-.01 2.83 0 .27.18.6.69.49A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path d="M14.72 10.36 22.1 2h-1.75l-6.42 7.27L8.8 2H2l7.73 11.04L2 22h1.75l6.76-7.66L15.2 22H22l-7.28-11.64Zm-2.39 2.71-.78-1.1-6.23-8.74h2.68l5.03 7.05.78 1.1 6.54 9.17h-2.68l-5.34-7.48Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d="M4 6.5h16A1.5 1.5 0 0 1 21.5 8v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m4 7 8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FooterLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="text-sm text-ink-soft transition-colors duration-[160ms] ease-out-soft hover:text-ink"
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))_auto]">
          <div className="min-w-0">
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
          <nav aria-label="Product">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              Product
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {productLinks.map((link) => (
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
          <nav aria-label="Social">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              Connect
            </h2>
            <ul className="mt-3 flex items-center gap-2">
              {socialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                      rel="noreferrer"
                      aria-label={link.label}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-ink-soft transition-[transform,color,background-color,border-color] duration-[160ms] ease-out-soft hover:scale-[0.96] hover:border-ink hover:bg-surface-sunken hover:text-ink motion-reduce:hover:scale-100"
                    >
                      <Icon />
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
