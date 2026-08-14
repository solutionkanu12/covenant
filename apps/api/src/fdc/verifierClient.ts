import type { Hex } from "viem";
import {
  fdcPublicVerifierApiKey,
  fdcVerifierBaseUrl,
  paymentAttestationType,
  rpnAttestationType,
  testXrpSourceId,
} from "./constants.js";

export type PaymentRequestBody = {
  transactionId: Hex;
  inUtxo: "0";
  utxo: "0";
};

export type RpnRequestBody = {
  minimalBlockNumber: string;
  deadlineBlockNumber: string;
  deadlineTimestamp: string;
  destinationAddressHash: Hex;
  amount: string;
  standardPaymentReference: Hex;
  checkSourceAddresses: false;
  sourceAddressesRoot: Hex;
};

export type PrepareRequestResult =
  | { valid: true; abiEncodedRequest: Hex }
  | { valid: false; status: string };

async function callPrepareRequest(
  path: string,
  body: unknown,
): Promise<PrepareRequestResult> {
  const response = await fetch(
    `${fdcVerifierBaseUrl.replace(/\/$/, "")}${path}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-API-KEY": fdcPublicVerifierApiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok)
    throw new Error(`FDC verifier returned HTTP ${response.status}`);
  const data = (await response.json()) as {
    status: string;
    abiEncodedRequest?: string;
  };
  if (data.status === "VALID" && data.abiEncodedRequest)
    return { valid: true, abiEncodedRequest: data.abiEncodedRequest as Hex };
  return { valid: false, status: data.status };
}

export function preparePaymentRequest(transactionId: Hex) {
  return callPrepareRequest("/Payment/prepareRequest", {
    attestationType: paymentAttestationType,
    sourceId: testXrpSourceId,
    requestBody: { transactionId, inUtxo: "0", utxo: "0" } satisfies PaymentRequestBody,
  });
}

export function prepareReferencedPaymentNonexistenceRequest(
  body: RpnRequestBody,
) {
  return callPrepareRequest("/ReferencedPaymentNonexistence/prepareRequest", {
    attestationType: rpnAttestationType,
    sourceId: testXrpSourceId,
    requestBody: body,
  });
}
