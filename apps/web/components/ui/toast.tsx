"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cx } from "@/lib/cx";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

export type ToastInput = {
  tone?: ToastTone;
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
};

type Toast = ToastInput & { id: number };

const ToastContext = createContext<{
  push: (toast: ToastInput) => void;
} | null>(null);

const toneBorder: Record<ToastTone, string> = {
  neutral: "border-line-strong",
  success: "border-success",
  warning: "border-warning",
  danger: "border-danger",
};

const toneDot: Record<ToastTone, string> = {
  neutral: "bg-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current.slice(-3), { id, ...input }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((toast) => {
          const tone = toast.tone ?? "neutral";
          return (
            <div
              key={toast.id}
              className={cx(
                "pointer-events-auto w-full max-w-sm rounded-xl border-l-4 border border-line bg-surface p-4 shadow-dialog",
                toneBorder[tone],
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cx(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    toneDot[tone],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {toast.title}
                  </p>
                  {toast.description ? (
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {toast.description}
                    </p>
                  ) : null}
                  {toast.href ? (
                    <a
                      href={toast.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-block text-sm font-semibold text-accent hover:text-accent-strong"
                    >
                      {toast.hrefLabel ?? "View details"}
                    </a>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 ease-out-soft hover:bg-surface-sunken hover:text-ink"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  >
                    <path
                      d="M5 5l10 10M15 5L5 15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): { push: (toast: ToastInput) => void } {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
