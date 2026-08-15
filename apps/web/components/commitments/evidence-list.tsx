import type { SettlementEvent, SettlementEventKind } from "@/lib/commitment-types";
import { explorerTxUrl } from "@/lib/chains";
import { truncateHex } from "@/lib/format";

const kindLabel: Record<SettlementEventKind, string> = {
  created: "Commitment created",
  fulfilled: "Settled: fulfilled",
  defaulted: "Settled: defaulted",
};

export function EvidenceList({ evidence }: { evidence: SettlementEvent[] }) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Evidence</h2>
        <p className="mt-2 text-sm text-ink-soft">
          No onchain events are indexed for this commitment yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold tracking-tight text-ink">Evidence</h2>
      <ol className="mt-4 border-t border-line">
        {evidence.map((event) => (
          <li
            key={event.id}
            className="flex flex-col gap-1 border-b border-line py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-ink">{kindLabel[event.kind]}</p>
              <p className="text-xs text-muted">Block {event.block_number}</p>
            </div>
            <a
              href={explorerTxUrl(event.transaction_hash)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm text-accent hover:text-accent-strong"
            >
              {truncateHex(event.transaction_hash)}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
