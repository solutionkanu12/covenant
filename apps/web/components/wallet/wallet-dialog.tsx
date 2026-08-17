"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnect, type Connector } from "wagmi";

import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

function connectorLabel(connector: Connector): string {
  if (connector.id === "injected") {
    return "Browser wallet";
  }
  return connector.name;
}

function friendlyConnectError(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  if (name.includes("UserRejectedRequestError")) {
    return "The request was cancelled in the wallet.";
  }
  if (name.includes("ConnectorAlreadyConnectedError")) {
    return "This wallet is already connected.";
  }
  return "The wallet could not be reached. Check that it is unlocked and try again.";
}

export function WalletDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connectors, connect, isPending, reset } = useConnect();
  const { push } = useToast();
  const router = useRouter();
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setPendingUid(null);
      reset();
    }
  }, [open, reset]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Connect a wallet"
      description="Covenant runs on the Flare Coston2 testnet. Your wallet controls every action, keys never leave it."
    >
      <div className="flex flex-col gap-2">
        {connectors.map((connector) => {
          const pending = isPending && pendingUid === connector.uid;
          return (
            <button
              key={connector.uid}
              type="button"
              disabled={isPending}
              onClick={() => {
                setPendingUid(connector.uid);
                setErrorMessage(null);
                connect(
                  { connector },
                  {
                    onSuccess: () => {
                      push({ tone: "success", title: "Wallet connected" });
                      onClose();
                      router.push("/vault");
                    },
                    onError: (error) => {
                      setErrorMessage(friendlyConnectError(error));
                    },
                    onSettled: () => setPendingUid(null),
                  },
                );
              }}
              className="flex h-12 items-center justify-between rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink transition-[transform,color,background-color] duration-[160ms] ease-out-soft hover:scale-[0.96] hover:bg-surface-sunken motion-reduce:hover:scale-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {connectorLabel(connector)}
              {pending ? <Spinner size="sm" /> : null}
            </button>
          );
        })}
      </div>
      {errorMessage ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-muted">
        Connecting never moves funds. Covenant asks for signatures only when you
        act.
      </p>
    </Dialog>
  );
}
