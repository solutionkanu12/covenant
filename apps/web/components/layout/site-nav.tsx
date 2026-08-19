import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ConnectButton } from "@/components/wallet/connect-button";
import { cx } from "@/lib/cx";
import { MobileMenu, type NavLink } from "./mobile-menu";

export const publicNavLinks: NavLink[] = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#deployment", label: "Deployment" },
];

export const dashboardNavLinks: NavLink[] = [
  { href: "/vault", label: "Vault" },
  { href: "/deployment", label: "Deployment" },
  { href: "/how-it-works", label: "How it works" },
];

export function SiteNav({
  variant = "bar",
  links = publicNavLinks,
  className,
}: {
  variant?: "bar" | "floating";
  links?: NavLink[];
  className?: string;
}) {
  const floating = variant === "floating";

  return (
    <header
      className={cx(
        floating
          ? "pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4"
          : "sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md",
        className,
      )}
    >
      <div
        className={cx(
          "flex items-center justify-between gap-3",
          floating
            ? "pointer-events-auto mx-auto h-11 max-w-3xl min-w-0 rounded-full border border-line bg-surface/80 px-2 backdrop-blur-md sm:h-12 sm:px-3"
            : "mx-auto h-14 max-w-6xl min-w-0 px-4 sm:px-6",
        )}
      >
        <Link
          href="/"
          aria-label="Covenant home"
          className="shrink-0 rounded-full outline-offset-4"
        >
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden min-w-0 md:block">
          <ul className="flex items-center gap-0.5">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft transition-[transform,color,background-color] duration-[160ms] ease-out-soft hover:scale-[0.96] hover:bg-raised hover:text-ink motion-reduce:hover:scale-100"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ConnectButton size="sm" />
          <MobileMenu links={links} />
        </div>
      </div>
    </header>
  );
}
