import { covenantCoston2Deployment } from "@covenant/shared";

import { explorerAddressUrl } from "@/lib/chains";
import { truncateHex } from "@/lib/format";

const rows = [
  {
    label: "Escrow",
    value: covenantCoston2Deployment.covenantEscrow,
  },
  {
    label: "FXRP",
    value: covenantCoston2Deployment.collateralToken,
  },
  {
    label: "FDC",
    value: covenantCoston2Deployment.fdcVerification,
  },
];

export function Deployment() {
  return (
    <section
      id="deployment"
      className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6"
    >
      <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Deployment
          </h2>
          <p className="text-sm font-semibold text-ink-soft">
            Coston2 · chain {covenantCoston2Deployment.chainId}
          </p>
        </div>
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex min-w-0 items-center justify-between gap-4 py-3"
            >
              <span className="shrink-0 text-sm font-semibold text-ink-soft">
                {row.label}
              </span>
              <span className="flex min-w-0 items-center gap-3">
                <span className="font-mono text-sm text-ink">
                  {truncateHex(row.value)}
                </span>
                <a
                  href={explorerAddressUrl(row.value)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`View ${row.label} on the Coston2 explorer`}
                  className="shrink-0 text-sm font-semibold text-accent transition-colors duration-[160ms] ease-out-soft hover:text-accent-strong"
                >
                  View
                </a>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm leading-6 text-muted">
          Public Coston2 testnet. Test value only.
        </p>
      </div>
    </section>
  );
}
