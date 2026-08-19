"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isWalletGatedPath } from "@/lib/wallet-status";
import { DashboardGuard } from "@/components/wallet/dashboard-guard";
import { DashboardSidebar } from "./dashboard-sidebar";
import { SiteFooter } from "./site-footer";
import { SiteNav, dashboardNavLinks, publicNavLinks } from "./site-nav";

function isDashboardPath(pathname: string) {
  return (
    pathname === "/vault" ||
    pathname.startsWith("/commitments") ||
    pathname === "/how-it-works" ||
    pathname === "/deployment"
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isDashboard = isDashboardPath(pathname);

  if (isDashboard) {
    return (
      <div className="flex min-h-screen">
        {isWalletGatedPath(pathname) ? <DashboardGuard /> : null}
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <SiteNav
            variant="bar"
            links={dashboardNavLinks}
            className="lg:hidden"
          />
          <main id="main" className="flex-1">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteNav
        variant={isLanding ? "floating" : "bar"}
        links={publicNavLinks}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
