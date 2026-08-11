import { createTestnetClient, loadOrFundWallet } from "./xrpl-testnet.js";

const client = createTestnetClient();

try {
  await client.connect();
  const payer = await loadOrFundWallet(client, "PAYER");
  const recipient = await loadOrFundWallet(client, "RECIPIENT");

  console.log(
    JSON.stringify({
      network: "XRPL Testnet",
      payer: { address: payer.wallet.address, created: payer.created },
      recipient: {
        address: recipient.wallet.address,
        created: recipient.created,
      },
      seedsStoredIn: ".env",
    }),
  );
} catch (error) {
  console.error(
    "XRPL Testnet wallet setup failed without exposing secrets",
    error,
  );
  process.exitCode = 1;
} finally {
  if (client.isConnected()) {
    await client.disconnect();
  }
}
