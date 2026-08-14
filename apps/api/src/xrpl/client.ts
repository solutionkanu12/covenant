import { Client } from "xrpl";
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
