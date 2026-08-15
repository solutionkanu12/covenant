"use client";

import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { explorerAddressUrl } from "@/lib/chains";

export function AccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { address, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { push } = useToast();
  const [copied, setCopied] = useState(false);

  if (!address) {
    return null;
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      push({
        tone: "warning",
        title: "Copy failed",
        description: "Select the address and copy it manually.",
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Wallet">
      <div className="flex items-center justify-between gap-3">
        <Badge tone="success" dot>
          {chain?.name ?? "Connected"}
        </Badge>
        <a
          href={explorerAddressUrl(address)}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-accent hover:text-accent-strong"
        >
          View on explorer
        </a>
      </div>
      <div className="mt-4 rounded-xl border border-line bg-surface-sunken p-4">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          Address
        </p>
        <p className="mt-1 font-mono text-sm break-all text-ink">{address}</p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => void copyAddress()}
        >
          {copied ? "Copied" : "Copy address"}
        </Button>
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() => {
            disconnect();
            push({ title: "Wallet disconnected" });
            onClose();
          }}
        >
          Disconnect
        </Button>
      </div>
    </Dialog>
  );
}
