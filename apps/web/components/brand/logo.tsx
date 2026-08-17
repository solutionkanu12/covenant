import { cx } from "@/lib/cx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/covenant-mark.png"
      alt=""
      width={28}
      height={28}
      className={cx("h-7 w-7 rounded-md", className)}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight text-ink max-sm:sr-only">
        Covenant
      </span>
    </span>
  );
}
