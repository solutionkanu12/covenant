import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/lib/cx";
import { Spinner } from "./spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "primaryOnDark"
  | "secondaryOnDark"
  | "ghostOnDark";
export type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-ink hover:bg-accent-strong disabled:hover:bg-accent",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-raised disabled:hover:bg-surface",
  ghost: "text-ink-soft hover:bg-raised hover:text-ink",
  danger: "bg-danger text-ink hover:bg-accent-strong disabled:hover:bg-danger",
  primaryOnDark:
    "bg-accent text-ink hover:bg-accent-strong disabled:hover:bg-accent",
  secondaryOnDark:
    "border border-line bg-transparent text-ink hover:bg-white/8 disabled:hover:bg-transparent",
  ghostOnDark: "text-ink hover:bg-white/8",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 gap-2 px-4 text-sm",
  md: "h-11 gap-2 px-5 text-sm",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cx(
    "inline-flex select-none items-center justify-center rounded-full font-semibold whitespace-nowrap",
    "transition-[transform,color,background-color,border-color] duration-[160ms] ease-out-soft",
    "hover:scale-[0.96] motion-reduce:hover:scale-100",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
