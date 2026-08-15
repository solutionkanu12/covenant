import { cx } from "@/lib/cx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cx("h-7 w-7", className)}
    >
      <path
        d="M23.42 8.58A10.5 10.5 0 1 0 23.42 23.42"
        stroke="currentColor"
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <circle cx={16} cy={16} r={3} fill="currentColor" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight text-ink">
        Covenant
      </span>
    </span>
  );
}
