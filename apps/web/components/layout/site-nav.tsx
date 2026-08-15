import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ConnectButton } from "@/components/wallet/connect-button";
import { MobileMenu, type NavLink } from "./mobile-menu";

const navLinks: NavLink[] = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#deployment", label: "Deployment" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Covenant home"
          className="rounded-full outline-offset-4"
        >
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink-soft transition-colors duration-150 ease-out-soft hover:bg-surface-sunken hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <ConnectButton />
          <MobileMenu links={navLinks} />
        </div>
      </div>
    </header>
  );
}
