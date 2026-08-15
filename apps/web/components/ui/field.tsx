import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { cx } from "@/lib/cx";

const controlClasses =
  "w-full rounded-xl border border-line-strong bg-surface px-4 text-sm text-ink placeholder:text-muted transition-colors duration-150 ease-out-soft hover:border-line-strong focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  const descriptionId = `${htmlFor}-description`;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={descriptionId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ invalid, className, id, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <input
      id={inputId}
      aria-invalid={invalid || undefined}
      aria-describedby={`${inputId}-description`}
      className={cx(
        controlClasses,
        "h-11",
        invalid && "border-danger focus:border-danger",
        className,
      )}
      {...rest}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ invalid, className, id, ...rest }: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <textarea
      id={inputId}
      aria-invalid={invalid || undefined}
      aria-describedby={`${inputId}-description`}
      className={cx(
        controlClasses,
        "min-h-28 py-3",
        invalid && "border-danger focus:border-danger",
        className,
      )}
      {...rest}
    />
  );
}
