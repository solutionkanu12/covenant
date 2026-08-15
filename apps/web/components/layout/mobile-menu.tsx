"use client";

import Link from "next/link";
import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";

export type NavLink = { href: string; label: string };

export function MobileMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors duration-150 ease-out-soft hover:bg-surface-sunken"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path
            d="M3 6h14M3 10h14M3 14h14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Menu">
        <nav aria-label="Mobile">
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 text-base font-semibold text-ink transition-colors duration-150 ease-out-soft hover:bg-surface-sunken"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Dialog>
    </div>
  );
}
