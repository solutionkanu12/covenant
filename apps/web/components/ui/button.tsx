import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/lib/cx";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-raised disabled:hover:bg-ink",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-surface-sunken disabled:hover:bg-surface",
  ghost: "text-ink-soft hover:bg-surface-sunken hover:text-ink",
  danger: "bg-danger text-paper hover:bg-ink disabled:hover:bg-danger",
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
    "inline-flex select-none items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors duration-150 ease-out-soft",
    "disabled:cursor-not-allowed disabled:opacity-50",
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
