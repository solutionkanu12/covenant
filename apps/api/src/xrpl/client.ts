import { Client, rippleTimeToUnixTime } from "xrpl";
import type { ObservedMeta, ObservedTransaction } from "./observation.js";

export type FetchedTransaction = {
  transaction: ObservedTransaction;
  meta: ObservedMeta;
  validated: boolean;
  ledgerIndex: number;
};

export interface XrplTransactionSource {
  fetchTransaction(hash: string): Promise<FetchedTransaction | undefined>;
}

export function createXrplTransactionSource(
  wsUrl: string,
): XrplTransactionSource {
  return {
    async fetchTransaction(hash) {
      const client = new Client(wsUrl, { connectionTimeout: 15_000 });
      try {
        await client.connect();
        const response = await client.request({
          command: "tx",
          transaction: hash,
        });
        const result = response.result as unknown as {
          validated?: boolean;
          meta?: ObservedMeta;
          ledger_index?: number;
          tx_json?: ObservedTransaction;
        } & ObservedTransaction;
        if (typeof result.meta !== "object" || result.meta === null)
          return undefined;
        return {
          transaction: (result.tx_json ?? result) as ObservedTransaction,
          meta: result.meta,
          validated: result.validated === true,
          ledgerIndex: result.ledger_index ?? 0,
        };
      } catch (error) {
        if (
          error instanceof Error &&
          /txnNotFound/i.test(error.message)
        )
          return undefined;
        throw error;
      } finally {
        if (client.isConnected()) await client.disconnect();
      }
    },
  };
}

export type XrplLedgerSnapshot = { ledgerIndex: number; closeTimeUnix: number };

export interface XrplLedgerSource {
  /** The most recent validated (finalized) XRPL ledger. Public, read-only, no secrets. */
  currentLedger(): Promise<XrplLedgerSnapshot>;
}

export function createXrplLedgerSource(wsUrl: string): XrplLedgerSource {
  return {
    async currentLedger() {
      const client = new Client(wsUrl, { connectionTimeout: 15_000 });
      try {
        await client.connect();
        const response = await client.request({
          command: "ledger",
          ledger_index: "validated",
        });
        const result = response.result as unknown as {
          ledger_index: number;
          ledger: { close_time: number };
        };
        return {
          ledgerIndex: result.ledger_index,
          closeTimeUnix: Math.floor(
            rippleTimeToUnixTime(result.ledger.close_time) / 1000,
          ),
        };
      } finally {
        if (client.isConnected()) await client.disconnect();
      }
    },
  };
}
