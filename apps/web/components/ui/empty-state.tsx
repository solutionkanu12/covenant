import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export function EmptyState({
  tone = "neutral",
  title,
  description,
  action,
}: {
  tone?: "neutral" | "danger";
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className={cx(
          "h-2 w-2 rounded-full",
          tone === "danger" ? "bg-danger" : "bg-muted",
        )}
      />
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm leading-6 text-ink-soft">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
