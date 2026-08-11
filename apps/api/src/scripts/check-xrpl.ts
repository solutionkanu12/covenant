import { Client } from "xrpl";

const endpoint =
  process.env.XRPL_TESTNET_URL ?? "wss://s.altnet.rippletest.net:51233";
const client = new Client(endpoint, { connectionTimeout: 15_000 });

try {
  await client.connect();
  const validatedLedger = await client.getLedgerIndex();

  console.log(
    JSON.stringify({
      endpoint,
      network: "XRPL Testnet",
      rpcHealth: "ok",
      validatedLedger,
    }),
  );
} catch (error) {
  console.error("XRPL Testnet network check failed", error);
  process.exitCode = 1;
} finally {
  if (client.isConnected()) {
    await client.disconnect();
  }
}
