import type {
  CommitmentRecord,
  CommitmentStatus,
  FdcJobRecord,
  PaymentObservationResponse,
  PaymentRequestResponse,
  SettlementEvent,
  XrplLedgerSnapshot,
} from "./commitment-types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // Fastify rejects an empty body when content-type is application/json
  // (FST_ERR_CTP_EMPTY_JSON_BODY → 400 "Bad Request"). Only declare JSON
  // when we actually send a body.
  if (init?.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      typeof body?.error === "string" ? body.error : `Request failed (${response.status})`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export function listCommitments(params: {
  status?: CommitmentStatus;
  wallet?: string;
  limit?: number;
}): Promise<CommitmentRecord[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.wallet) query.set("wallet", params.wallet);
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString();
  return apiFetch(`/api/commitments${suffix ? `?${suffix}` : ""}`);
}

export function getCommitment(
  id: string,
): Promise<{ commitment: CommitmentRecord; evidence: SettlementEvent[] }> {
  return apiFetch(`/api/commitments/${encodeURIComponent(id)}`);
}

export function createPaymentRequest(
  id: string,
  xrplDestinationAddress: string,
): Promise<PaymentRequestResponse> {
  return apiFetch(`/api/commitments/${encodeURIComponent(id)}/payment-request`, {
    method: "POST",
    body: JSON.stringify({ xrplDestinationAddress }),
  });
}

export function submitPaymentObservation(
  id: string,
  transactionHash: string,
): Promise<PaymentObservationResponse> {
  return apiFetch(`/api/commitments/${encodeURIComponent(id)}/payment-observation`, {
    method: "POST",
    body: JSON.stringify({ transactionHash }),
  });
}

export function provePayment(id: string): Promise<FdcJobRecord> {
  return apiFetch(`/api/commitments/${encodeURIComponent(id)}/prove-payment`, {
    method: "POST",
  });
}

export function proveDefault(id: string): Promise<FdcJobRecord> {
  return apiFetch(`/api/commitments/${encodeURIComponent(id)}/prove-default`, {
    method: "POST",
  });
}

export function getFdcJob(id: string): Promise<FdcJobRecord> {
  return apiFetch(`/api/fdc/jobs/${encodeURIComponent(id)}`);
}

export function getCurrentLedger(): Promise<XrplLedgerSnapshot> {
  return apiFetch(`/api/xrpl/ledger`);
}
