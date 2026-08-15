import { cx } from "@/lib/cx";
import { txExplorerLink, txStatusLabel, type TxState } from "@/lib/tx";
import { Spinner } from "./spinner";

const statusHints: Record<TxState["status"], string | null> = {
  idle: null,
  signing: "Confirm the request in your wallet to continue.",
  pending: "The transaction is submitted. Settlement updates when it confirms.",
  confirmed: null,
  failed: null,
};

export function TxFeedback({
  state,
  className,
}: {
  state: TxState;
  className?: string;
}) {
  if (state.status === "idle") {
    return null;
  }

  const busy = state.status === "signing" || state.status === "pending";
  const failed = state.status === "failed";
  const confirmed = state.status === "confirmed";
  const hint = statusHints[state.status];

  return (
    <div
      role={failed ? "alert" : "status"}
      className={cx(
        "flex items-start gap-3 rounded-xl border p-4",
        failed && "border-danger bg-danger-soft",
        confirmed && "border-success bg-success-soft",
        busy && "border-line-strong bg-surface",
        className,
      )}
    >
      {busy ? (
        <Spinner size="sm" className="mt-0.5 text-ink-soft" />
      ) : (
        <span
          aria-hidden="true"
          className={cx(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            confirmed && "bg-success",
            failed && "bg-danger",
          )}
        />
      )}
      <div className="min-w-0">
        <p
          className={cx(
            "text-sm font-semibold",
            failed ? "text-danger" : confirmed ? "text-success" : "text-ink",
          )}
        >
          {txStatusLabel(state.status)}
        </p>
        {failed && state.errorMessage ? (
          <p className="mt-0.5 text-sm text-danger">{state.errorMessage}</p>
        ) : null}
        {busy && hint ? (
          <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>
        ) : null}
        {state.hash ? (
          <a
            href={txExplorerLink(state.hash)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm font-semibold break-all text-accent hover:text-accent-strong"
          >
            View on the Coston2 explorer
          </a>
        ) : null}
      </div>
    </div>
  );
}
