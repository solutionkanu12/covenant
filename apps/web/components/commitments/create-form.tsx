"use client";

import { covenantCoston2Deployment, covenantEscrowCreateAbi } from "@covenant/shared";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { readContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { TxFeedback } from "@/components/ui/tx-feedback";
import { getCurrentLedger } from "@/lib/api";
import { estimateDeadlineLedger } from "@/lib/commitment-status";
import { decodeCommitmentCreated } from "@/lib/escrow";
import { erc20Abi, FXRP_DECIMALS, FXRP_SYMBOL, XRP_DECIMALS } from "@/lib/erc20";
import { formatTokenAmount, parseTokenAmount } from "@/lib/format";
import { friendlyContractError, idleTxState, type TxState } from "@/lib/tx";
import { wagmiConfig } from "@/lib/wagmi";
import { isValidXrplAddress, xrplAddressHash } from "@/lib/xrpl";

const minLeadTimeMs = 15 * 60 * 1000;

type FormState = {
  beneficiary: string;
  recipientXrpl: string;
  xrpAmount: string;
  fxrpBond: string;
  deadlineLocal: string;
};

const initialForm: FormState = {
  beneficiary: "",
  recipientXrpl: "",
  xrpAmount: "",
  fxrpBond: "",
  deadlineLocal: "",
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): { errors: FieldErrors; deadlineMs?: number } {
  const errors: FieldErrors = {};
  if (!isAddress(form.beneficiary.trim()))
    errors.beneficiary = "Enter a valid Flare wallet address";
  if (!isValidXrplAddress(form.recipientXrpl))
    errors.recipientXrpl = "Enter a valid XRPL address, starting with r";
  try {
    parseTokenAmount(form.xrpAmount, XRP_DECIMALS);
  } catch (error) {
    errors.xrpAmount = error instanceof Error ? error.message : "Enter a valid amount";
  }
  try {
    parseTokenAmount(form.fxrpBond, FXRP_DECIMALS);
  } catch (error) {
    errors.fxrpBond = error instanceof Error ? error.message : "Enter a valid amount";
  }
  let deadlineMs: number | undefined;
  if (!form.deadlineLocal) {
    errors.deadlineLocal = "Choose a deadline";
  } else {
    const parsed = new Date(form.deadlineLocal).getTime();
    if (Number.isNaN(parsed)) {
      errors.deadlineLocal = "Choose a valid date and time";
    } else if (parsed < Date.now() + minLeadTimeMs) {
      errors.deadlineLocal = "Choose a time at least 15 minutes from now";
    } else {
      deadlineMs = parsed;
    }
  }
  return { errors, deadlineMs };
}

export function CreateForm() {
  const router = useRouter();
  const { address } = useAccount();
  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [approveState, setApproveState] = useState<TxState>(idleTxState);
  const [createState, setCreateState] = useState<TxState>(idleTxState);
  const [submitting, setSubmitting] = useState(false);

  const update =
    (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    };

  const bondPreview = (() => {
    try {
      return formatTokenAmount(parseTokenAmount(form.fxrpBond || "0", FXRP_DECIMALS), FXRP_DECIMALS);
    } catch {
      return null;
    }
  })();
  const xrpPreview = (() => {
    try {
      return formatTokenAmount(parseTokenAmount(form.xrpAmount || "0", XRP_DECIMALS), XRP_DECIMALS);
    } catch {
      return null;
    }
  })();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!address) return;
    const { errors, deadlineMs } = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || deadlineMs === undefined) return;

    setSubmitting(true);
    setApproveState(idleTxState);
    setCreateState(idleTxState);
    let step: "approve" | "create" = "approve";
    try {
      const bondAmount = parseTokenAmount(form.fxrpBond, FXRP_DECIMALS);
      const xrpAmountDrops = parseTokenAmount(form.xrpAmount, XRP_DECIMALS);
      const beneficiary = form.beneficiary.trim() as `0x${string}`;
      const deadlineTimestamp = BigInt(Math.floor(deadlineMs / 1000));

      const allowance = await readContract(wagmiConfig, {
        address: covenantCoston2Deployment.collateralToken as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, covenantCoston2Deployment.covenantEscrow as `0x${string}`],
      });

      if (allowance < bondAmount) {
        setApproveState({ status: "signing" });
        const approveHash = await writeContract(wagmiConfig, {
          address: covenantCoston2Deployment.collateralToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [covenantCoston2Deployment.covenantEscrow as `0x${string}`, bondAmount],
        });
        setApproveState({ status: "pending", hash: approveHash });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        setApproveState({ status: "confirmed", hash: approveHash });
      }

      step = "create";
      setCreateState({ status: "signing" });
      const ledger = await getCurrentLedger();
      const minimalLedger = BigInt(ledger.ledgerIndex);
      const deadlineLedger = BigInt(
        estimateDeadlineLedger(
          ledger.ledgerIndex,
          ledger.closeTimeUnix,
          Number(deadlineTimestamp),
        ),
      );
      const destinationHash = xrplAddressHash(form.recipientXrpl);

      const createHash = await writeContract(wagmiConfig, {
        address: covenantCoston2Deployment.covenantEscrow as `0x${string}`,
        abi: covenantEscrowCreateAbi,
        functionName: "createCommitment",
        args: [
          beneficiary,
          destinationHash,
          xrpAmountDrops,
          bondAmount,
          minimalLedger,
          deadlineLedger,
          deadlineTimestamp,
        ],
      });
      setCreateState({ status: "pending", hash: createHash });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: createHash });
      setCreateState({ status: "confirmed", hash: createHash });

      const decoded = decodeCommitmentCreated(
        receipt.logs,
        covenantCoston2Deployment.covenantEscrow as `0x${string}`,
      );
      if (decoded) {
        router.push(
          `/commitments/${decoded.commitmentId.toString()}?created=${createHash}`,
        );
      }
    } catch (error) {
      const message = friendlyContractError(error);
      if (step === "approve") setApproveState({ status: "failed", errorMessage: message });
      else setCreateState({ status: "failed", errorMessage: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <Field
        label="Recipient's Flare wallet address"
        htmlFor="beneficiary"
        hint="Receives the FXRP bond only if the payment is missed."
        error={fieldErrors.beneficiary}
      >
        <Input
          id="beneficiary"
          value={form.beneficiary}
          onChange={update("beneficiary")}
          placeholder="0x..."
          invalid={Boolean(fieldErrors.beneficiary)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Field
        label="Recipient's XRPL address"
        htmlFor="recipientXrpl"
        hint="Where the XRP payment must arrive."
        error={fieldErrors.recipientXrpl}
      >
        <Input
          id="recipientXrpl"
          value={form.recipientXrpl}
          onChange={update("recipientXrpl")}
          placeholder="r..."
          invalid={Boolean(fieldErrors.recipientXrpl)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="XRP amount to pay"
          htmlFor="xrpAmount"
          hint="The exact amount the payer must send on XRPL."
          error={fieldErrors.xrpAmount}
        >
          <Input
            id="xrpAmount"
            value={form.xrpAmount}
            onChange={update("xrpAmount")}
            placeholder="0.00"
            inputMode="decimal"
            invalid={Boolean(fieldErrors.xrpAmount)}
          />
        </Field>
        <Field
          label={`${FXRP_SYMBOL} bond to lock`}
          htmlFor="fxrpBond"
          hint="Collateral locked in the escrow contract on Coston2."
          error={fieldErrors.fxrpBond}
        >
          <Input
            id="fxrpBond"
            value={form.fxrpBond}
            onChange={update("fxrpBond")}
            placeholder="0.00"
            inputMode="decimal"
            invalid={Boolean(fieldErrors.fxrpBond)}
          />
        </Field>
      </div>

      <Field
        label="Payment deadline"
        htmlFor="deadlineLocal"
        hint="At least 15 minutes from now, in your local time."
        error={fieldErrors.deadlineLocal}
      >
        <Input
          id="deadlineLocal"
          type="datetime-local"
          value={form.deadlineLocal}
          onChange={update("deadlineLocal")}
          invalid={Boolean(fieldErrors.deadlineLocal)}
        />
      </Field>

      {bondPreview && xrpPreview && form.recipientXrpl && form.beneficiary ? (
        <div className="rounded-xl border border-line bg-surface-sunken p-4 text-sm leading-6 text-ink-soft">
          You will lock <span className="font-semibold text-ink">{bondPreview} {FXRP_SYMBOL}</span>.
          If <span className="font-semibold text-ink">{xrpPreview} XRP</span> reaches the recipient
          on XRPL by the deadline, the bond returns to you. If it does not, Flare&apos;s proof
          sends the bond to the recipient&apos;s Flare address instead.
        </div>
      ) : null}

      {approveState.status !== "idle" ? (
        <TxFeedback state={approveState} />
      ) : null}
      {createState.status !== "idle" ? <TxFeedback state={createState} /> : null}

      <Button type="submit" size="md" loading={submitting} loadingLabel="Processing">
        Lock bond and create commitment
      </Button>
    </form>
  );
}
