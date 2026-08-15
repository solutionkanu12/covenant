"use client";

import { useEffect, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";

import { Button, type ButtonSize } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { COSTON2_CHAIN_ID, coston2 } from "@/lib/chains";
import { truncateHex } from "@/lib/format";
import { AccountDialog } from "./account-dialog";
import { WalletDialog } from "./wallet-dialog";

export function ConnectButton({ size = "sm" }: { size?: ButtonSize }) {
  const [mounted, setMounted] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { address, isConnected, isReconnecting, chainId } = useAccount();
  const { mutate: switchChain, isPending: isSwitching } = useSwitchChain();
  const { push } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="primary" size={size} disabled>
        Connect wallet
      </Button>
    );
  }

  if (isReconnecting) {
    return (
      <Button variant="secondary" size={size} loading loadingLabel="Restoring">
        Restoring
      </Button>
    );
  }

  if (!isConnected || !address) {
    return (
      <>
        <Button
          variant="primary"
          size={size}
          onClick={() => setWalletOpen(true)}
        >
          Connect wallet
        </Button>
        <WalletDialog open={walletOpen} onClose={() => setWalletOpen(false)} />
      </>
    );
  }

  if (chainId !== COSTON2_CHAIN_ID) {
    return (
      <Button
        variant="secondary"
        size={size}
        loading={isSwitching}
        loadingLabel="Switching"
        onClick={() =>
          switchChain(
            { chainId: COSTON2_CHAIN_ID },
            {
              onSuccess: () =>
                push({
                  tone: "success",
                  title: `Switched to ${coston2.name}`,
                }),
              onError: () =>
                push({
                  tone: "warning",
                  title: "Network switch cancelled",
                  description: `Covenant needs ${coston2.name} to read commitments and lock bonds.`,
                }),
            },
          )
        }
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-warning" />
        Wrong network
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        onClick={() => setAccountOpen(true)}
        aria-label={`Wallet ${address}, connected to ${coston2.name}`}
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />
        <span className="font-mono">{truncateHex(address)}</span>
      </Button>
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}
