import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { xrpToDrops } from "xrpl";
import type { Payment } from "xrpl";

import { createTestnetClient, loadExistingWallet } from "./xrpl-testnet.js";

const amountDrops = "1000000";
const fixturePath = fileURLToPath(
  new URL("../../fixtures/phase-1b-xrpl-payment.json", import.meta.url),
);
const partialPaymentFlag = 0x00020000;

type PaymentRecord = Payment & {
  DeliverMax?: unknown;
  hash?: string;
};

type PaymentProof = {
  ledgerIndex: number;
  metadata: {
    DeliveredAmount?: unknown;
    TransactionResult?: string;
    delivered_amount?: unknown;
  };
  transaction: PaymentRecord;
  transactionHash: string;
  validated: boolean;
};

function normalizeXrpAmountToDrops(amount: unknown): string | undefined {
  if (typeof amount === "string") {
    return amount;
  }
  if (
    typeof amount === "object" &&
    amount !== null &&
    "currency" in amount &&
    amount.currency === "XRP" &&
    "value" in amount &&
    typeof amount.value === "string"
  ) {
    return xrpToDrops(amount.value);
  }
  return undefined;
}

function verifyPayment(
  proof: PaymentProof,
  payerAddress: string,
  recipientAddress: string,
): string {
  const { metadata, transaction } = proof;
  const memos = transaction.Memos ?? [];
  const reference = memos[0]?.Memo.MemoData;
  const requestedAmount = transaction.Amount ?? transaction.DeliverMax;
  const deliveredAmount = metadata.delivered_amount ?? metadata.DeliveredAmount;
  const numericFlags =
    typeof transaction.Flags === "number" ? transaction.Flags : 0;

  const checks = {
    amount:
      normalizeXrpAmountToDrops(requestedAmount) === amountDrops &&
      normalizeXrpAmountToDrops(deliveredAmount) === amountDrops,
    destination: transaction.Destination === recipientAddress,
    direct:
      transaction.Paths === undefined &&
      transaction.SendMax === undefined &&
      transaction.DeliverMin === undefined,
    memoCount: memos.length === 1,
    noPartialPayment: (numericFlags & partialPaymentFlag) === 0,
    payer: transaction.Account === payerAddress,
    reference:
      typeof reference === "string" && /^[0-9A-F]{64}$/.test(reference),
    result: metadata.TransactionResult === "tesSUCCESS",
    validated: proof.validated,
  };

  if (Object.values(checks).some((passed) => !passed)) {
    throw new Error(
      `Validated payment verification failed: ${JSON.stringify(checks)}`,
    );
  }

  return reference as string;
}

async function findExistingPayment(
  client: ReturnType<typeof createTestnetClient>,
  payerAddress: string,
  recipientAddress: string,
): Promise<PaymentProof | undefined> {
  const response = await client.request({
    account: payerAddress,
    command: "account_tx",
    ledger_index_max: -1,
    ledger_index_min: -1,
    limit: 20,
  });

  for (const record of response.result.transactions) {
    if (typeof record.meta === "string") {
      continue;
    }
    const legacyRecord = record as typeof record & {
      tx?: PaymentRecord;
    };
    const transaction = (record.tx_json ?? legacyRecord.tx) as
      PaymentRecord | undefined;
    const transactionHash = record.hash ?? transaction?.hash;
    if (!transaction || !transactionHash) {
      continue;
    }
    const candidate: PaymentProof = {
      ledgerIndex: record.ledger_index,
      metadata: record.meta,
      transaction,
      transactionHash,
      validated: record.validated,
    };

    try {
      verifyPayment(candidate, payerAddress, recipientAddress);
      return candidate;
    } catch {
      // Ignore faucet and unrelated account transactions.
    }
  }

  return undefined;
}

const payer = await loadExistingWallet("PAYER");
const recipient = await loadExistingWallet("RECIPIENT");
let proof: PaymentProof | undefined;
let lastError: unknown;

for (let attempt = 1; attempt <= 3 && !proof; attempt += 1) {
  const client = createTestnetClient(45_000);
  try {
    await client.connect();
    proof = await findExistingPayment(client, payer.address, recipient.address);
    if (!proof) {
      throw new Error(
        "Existing referenced payment was not found in account history",
      );
    }
  } catch (error) {
    lastError = error;
    if (attempt < 3) {
      console.error(
        `Read-only XRPL recovery attempt ${attempt} failed; retrying`,
      );
    }
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

if (!proof) {
  console.error(
    "Referenced XRPL Testnet payment recovery failed after three read-only attempts",
    lastError,
  );
  process.exitCode = 1;
} else {
  try {
    const reference = verifyPayment(proof, payer.address, recipient.address);

    const fixture = {
      amount: "1 XRP",
      destinationAddress: recipient.address,
      ledgerIndex: proof.ledgerIndex,
      payerAddress: payer.address,
      reference,
      transactionHash: proof.transactionHash,
      validationResult: "tesSUCCESS",
    };

    await mkdir(fileURLToPath(new URL("../../fixtures", import.meta.url)), {
      recursive: true,
    });
    await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, {
      encoding: "utf8",
    });
    console.log(JSON.stringify(fixture));
  } catch (error) {
    console.error(
      "Referenced XRPL Testnet payment verification failed without exposing secrets",
      error,
    );
    process.exitCode = 1;
  }
}
