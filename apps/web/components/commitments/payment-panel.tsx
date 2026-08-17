"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { createPaymentRequest, submitPaymentObservation } from "@/lib/api";
import type { CommitmentRecord } from "@/lib/commitment-types";
import { isValidXrplAddress } from "@/lib/xrpl";

export function PaymentPanel({ commitment }: { commitment: CommitmentRecord }) {
  const { push } = useToast();
  const [destinationInput, setDestinationInput] = useState("");
  const [destinationError, setDestinationError] = useState<string | undefined>();
  const [confirmedDestination, setConfirmedDestination] = useState<string | null>(
    commitment.recipient_xrpl_address,
  );
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);

  const requestQuery = useQuery({
    queryKey: ["payment-request", commitment.commitment_id, confirmedDestination],
    queryFn: () => createPaymentRequest(commitment.commitment_id, confirmedDestination!),
    enabled: Boolean(confirmedDestination),
    staleTime: Infinity,
  });

  const observationMutation = useMutation({
    mutationFn: (hash: string) => submitPaymentObservation(commitment.commitment_id, hash),
    onSuccess: () => {
      push({
        tone: "success",
        title: "Payment observed",
        description: "This is informational evidence only. Settlement still needs a verified FDC proof.",
      });
      setTxHash("");
    },
  });

  const copyJson = async (json: string) => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      push({ tone: "warning", title: "Copy failed", description: "Select the text and copy it manually." });
    }
  };

  if (!confirmedDestination) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Confirm the XRPL destination</h2>
        <p className="mt-1.5 text-sm leading-6 text-ink-soft">
          Enter the recipient&apos;s XRPL address again to generate the exact payment request.
          Covenant checks it against the address committed onchain before showing anything.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            label="Recipient's XRPL address"
            htmlFor="destination"
            className="flex-1"
            error={destinationError}
          >
            <Input
              id="destination"
              value={destinationInput}
              onChange={(event) => {
                setDestinationInput(event.target.value);
                setDestinationError(undefined);
              }}
              placeholder="r..."
              invalid={Boolean(destinationError)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Button
            variant="secondary"
            onClick={() => {
              if (!isValidXrplAddress(destinationInput)) {
                setDestinationError("Enter a valid XRPL address, starting with r");
                return;
              }
              setConfirmedDestination(destinationInput.trim());
            }}
          >
            Generate payment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold tracking-tight text-ink">Pay on XRPL</h2>
      <p className="mt-1.5 text-sm leading-6 text-ink-soft">
        Sign this exact payment from your own XRPL wallet. The reference memo is already
        attached; never type it by hand or remove it.
      </p>

      {requestQuery.isPending ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : requestQuery.isError ? (
        <div className="mt-5 rounded-xl border border-danger bg-danger-soft p-4 text-sm text-danger">
          {requestQuery.error instanceof Error
            ? requestQuery.error.message
            : "Could not generate the payment request."}
        </div>
      ) : requestQuery.data ? (
        <div className="mt-5 flex flex-col gap-5">
          {requestQuery.data.xaman ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface-sunken p-5 sm:flex-row sm:items-start">
              {/* Xaman-hosted QR image; not a Next-optimized local asset. */}
              <img
                src={requestQuery.data.xaman.qrPng}
                alt="Xaman sign request QR code"
                className="h-40 w-40 rounded-lg border border-line bg-surface"
              />
              <div className="flex flex-col gap-2 text-sm text-ink-soft">
                <p>Scan with Xaman, or open it directly on this device.</p>
                <a
                  href={requestQuery.data.xaman.deeplink}
                  className="inline-flex w-fit items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition-[transform,color,background-color] duration-[160ms] ease-out-soft hover:scale-[0.96] hover:bg-accent-strong motion-reduce:hover:scale-100"
                >
                  Open in Xaman
                </a>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">
              Xaman is not configured for this deployment. Use the transaction JSON below with
              any XRPL wallet that accepts a raw payment.
            </p>
          )}

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                Transaction JSON
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void copyJson(requestQuery.data.transactionJson)}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface-sunken p-4 font-mono text-xs leading-6 text-ink">
              {requestQuery.data.transactionJson}
            </pre>
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-ink">Already paid?</h3>
            <p className="mt-1 text-sm leading-6 text-ink-soft">
              Enter the XRPL transaction hash to record it as evidence. This does not settle the
              commitment by itself; a verified Flare proof does that below.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="XRPL transaction hash" htmlFor="tx-hash" className="flex-1">
                <Input
                  id="tx-hash"
                  value={txHash}
                  onChange={(event) => setTxHash(event.target.value.trim())}
                  placeholder="Transaction hash"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Button
                variant="secondary"
                loading={observationMutation.isPending}
                loadingLabel="Checking"
                onClick={() => observationMutation.mutate(txHash)}
                disabled={!/^[0-9A-Fa-f]{64}$/.test(txHash)}
              >
                Record payment
              </Button>
            </div>
            {observationMutation.isError ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {observationMutation.error instanceof Error
                  ? observationMutation.error.message
                  : "That transaction could not be recorded."}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
