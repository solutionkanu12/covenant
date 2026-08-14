import { paymentReferenceToMemoData } from "./reference.js";

export type XrplPaymentPayload = {
  TransactionType: "Payment";
  Destination: string;
  Amount: string;
  Memos: [{ Memo: { MemoData: string } }];
};

/**
 * Builds the exact, safe XRP Payment transaction JSON from authoritative commitment data only.
 * Never accepts a client-supplied amount or reference: the destination is the sole caller input,
 * and it must already have been validated against the onchain xrplDestinationHash by the caller.
 */
export function buildXrplPaymentPayload(params: {
  destination: string;
  amountDrops: string;
  paymentReference: string;
}): XrplPaymentPayload {
  return {
    TransactionType: "Payment",
    Destination: params.destination,
    Amount: params.amountDrops,
    Memos: [
      { Memo: { MemoData: paymentReferenceToMemoData(params.paymentReference) } },
    ],
  };
}

export type XamanPayload = {
  uuid: string;
  qrPng: string;
  deeplink: string;
};

export type XamanConfig = { apiKey: string; apiSecret: string };

/**
 * Creates a Xaman (XUMM) sign request for the payload. Xaman resolves the signing account from
 * the connected wallet; Covenant never custodies XRP or holds a payer's XRPL key.
 */
export async function createXamanPayload(
  config: XamanConfig,
  payload: XrplPaymentPayload,
): Promise<XamanPayload> {
  const response = await fetch("https://xumm.app/api/v1/platform/payload", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-Key": config.apiKey,
      "X-API-Secret": config.apiSecret,
    },
    body: JSON.stringify({ txjson: payload }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`Xaman payload creation failed (${response.status})`);
  const data = (await response.json()) as {
    uuid: string;
    refs?: { qr_png?: string };
    next?: { always?: string };
  };
  if (!data.uuid || !data.next?.always || !data.refs?.qr_png)
    throw new Error("Xaman payload response was incomplete");
  return {
    uuid: data.uuid,
    qrPng: data.refs.qr_png,
    deeplink: data.next.always,
  };
}
