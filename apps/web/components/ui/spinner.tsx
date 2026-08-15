import { cx } from "@/lib/cx";

const spinnerSizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
} as const;

export function Spinner({
  size = "md",
  label = "Loading",
  className,
}: {
  size?: keyof typeof spinnerSizes;
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" className={cx("inline-flex", className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cx(
          "animate-spin motion-reduce:animate-none",
          spinnerSizes[size],
        )}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="3"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "animate-pulse rounded-lg bg-surface-sunken motion-reduce:animate-none",
        className,
      )}
    />
  );
}
