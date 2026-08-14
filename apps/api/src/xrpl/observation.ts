import { xrplAddressHash, paymentReferenceToMemoData } from "./reference.js";

const partialPaymentFlag = 0x00020000;

export type ObservedTransaction = {
  TransactionType?: unknown;
  Account?: unknown;
  Destination?: unknown;
  Amount?: unknown;
  DeliverMax?: unknown;
  Flags?: unknown;
  Paths?: unknown;
  SendMax?: unknown;
  DeliverMin?: unknown;
  Memos?: Array<{ Memo?: { MemoData?: unknown; MemoType?: unknown } }>;
};

export type ObservedMeta = {
  TransactionResult?: unknown;
  delivered_amount?: unknown;
  DeliveredAmount?: unknown;
};

export type ObservationExpectation = {
  destinationHash: string;
  amountDrops: bigint;
  paymentReference: string;
};

export type ObservationResult =
  | {
      valid: true;
      deliveredAmountDrops: string;
      destination: string;
    }
  | { valid: false; errors: string[] };

function xrpAmountToDrops(amount: unknown): string | undefined {
  if (typeof amount === "string") return amount;
  return undefined;
}

/**
 * Structural, pre-proof validation of an observed XRPL transaction against a commitment's
 * authoritative onchain terms. This is informational evidence only: it never settles a
 * commitment and must not be treated as proof of received value. Only a verified FDC Payment
 * proof (Phase 7) can do that, and it re-derives the delivered amount independently onchain.
 */
export function validateObservedPayment(
  transaction: ObservedTransaction,
  meta: ObservedMeta,
  validated: boolean,
  expected: ObservationExpectation,
): ObservationResult {
  const errors: string[] = [];

  if (transaction.TransactionType !== "Payment")
    errors.push("unsupported transaction type");
  if (!validated) errors.push("transaction is not yet validated");
  if (meta.TransactionResult !== "tesSUCCESS")
    errors.push("transaction did not succeed");

  const memos = transaction.Memos ?? [];
  if (memos.length === 0) errors.push("missing memo");
  else if (memos.length > 1) errors.push("multiple memos");
  else {
    const memoData = memos[0]?.Memo?.MemoData;
    let expectedMemoData: string | undefined;
    try {
      expectedMemoData = paymentReferenceToMemoData(expected.paymentReference);
    } catch {
      errors.push("expected payment reference is malformed");
    }
    if (
      typeof memoData !== "string" ||
      expectedMemoData === undefined ||
      memoData.toUpperCase() !== expectedMemoData
    )
      errors.push("incorrect reference");
  }

  if (
    typeof transaction.Destination !== "string" ||
    xrplAddressHash(transaction.Destination).toLowerCase() !==
      expected.destinationHash.toLowerCase()
  )
    errors.push("incorrect destination");

  if (
    transaction.Paths !== undefined ||
    transaction.SendMax !== undefined ||
    transaction.DeliverMin !== undefined
  )
    errors.push("malformed XRP payment payload");

  const numericFlags =
    typeof transaction.Flags === "number" ? transaction.Flags : 0;
  if ((numericFlags & partialPaymentFlag) !== 0)
    errors.push("malformed XRP payment payload");

  const requestedAmount = xrpAmountToDrops(
    transaction.Amount ?? transaction.DeliverMax,
  );
  const deliveredAmount = xrpAmountToDrops(
    meta.delivered_amount ?? meta.DeliveredAmount,
  );
  if (requestedAmount === undefined || deliveredAmount === undefined) {
    errors.push("malformed XRP payment payload");
  } else {
    try {
      if (BigInt(deliveredAmount) < expected.amountDrops)
        errors.push("incorrect or underpaid amount");
    } catch {
      errors.push("malformed XRP payment payload");
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    deliveredAmountDrops: xrpAmountToDrops(
      meta.delivered_amount ?? meta.DeliveredAmount,
    ) as string,
    destination: transaction.Destination as string,
  };
}
