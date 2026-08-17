"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { ConnectButton } from "@/components/wallet/connect-button";
import { cx } from "@/lib/cx";
import { dashboardNavLinks } from "./site-nav";

function isActive(pathname: string, href: string) {
  if (href === "/vault") {
    return pathname === "/vault" || pathname.startsWith("/commitments");
  }
  return pathname === href;
}

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col border-r border-line bg-surface px-3 py-6 lg:flex">
      <Link href="/" aria-label="Covenant home" className="px-2">
        <Logo />
      </Link>
      <nav aria-label="Dashboard" className="mt-8 flex flex-col gap-1">
        {dashboardNavLinks.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cx(
                "rounded-lg px-3 py-2.5 text-sm font-semibold transition-[transform,color,background-color] duration-[160ms] ease-out-soft hover:scale-[0.96] motion-reduce:hover:scale-100",
                active
                  ? "bg-raised text-ink"
                  : "text-ink-soft hover:bg-raised hover:text-ink",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-line px-1 pt-4">
        <p className="mb-2 px-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
          Wallet
        </p>
        <ConnectButton size="sm" className="w-full" />
      </div>
    </aside>
  );
}
