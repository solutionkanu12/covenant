import { appendFile, chmod, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { Client, Wallet } from "xrpl";

const expectedEndpoint = "wss://s.altnet.rippletest.net:51233";
const envPath = fileURLToPath(new URL("../../../../.env", import.meta.url));

type WalletRole = "PAYER" | "RECIPIENT";

function parseEnv(contents: string): Map<string, string> {
  const values = new Map<string, string>();

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      values.set(match[1], match[2]);
    }
  }

  return values;
}

async function readLocalEnv(): Promise<Map<string, string>> {
  try {
    return parseEnv(await readFile(envPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Map();
    }
    throw error;
  }
}

async function saveSeed(name: string, seed: string): Promise<void> {
  await appendFile(envPath, `${name}=${seed}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(envPath, 0o600);
}

export function createTestnetClient(connectionTimeout = 15_000): Client {
  const endpoint = process.env.XRPL_TESTNET_URL ?? expectedEndpoint;
  if (endpoint !== expectedEndpoint) {
    throw new Error(
      `Phase 1B is locked to XRPL Testnet at ${expectedEndpoint}; refusing ${endpoint}`,
    );
  }

  return new Client(endpoint, { connectionTimeout });
}

export async function loadExistingWallet(role: WalletRole): Promise<Wallet> {
  const name = `XRPL_TESTNET_${role}_SEED`;
  const localEnv = await readLocalEnv();
  const seed = process.env[name] ?? localEnv.get(name);

  if (!seed) {
    throw new Error(
      `Missing ${name}; recovery will not create or fund another wallet`,
    );
  }

  return Wallet.fromSeed(seed);
}

export async function loadOrFundWallet(
  client: Client,
  role: WalletRole,
): Promise<{ created: boolean; wallet: Wallet }> {
  try {
    return { created: false, wallet: await loadExistingWallet(role) };
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith("Missing ")) {
      throw error;
    }
  }

  const name = `XRPL_TESTNET_${role}_SEED`;
  const { wallet } = await client.fundWallet();
  if (!wallet.seed) {
    throw new Error(
      `XRPL faucet returned a ${role.toLowerCase()} wallet without a seed`,
    );
  }
  await saveSeed(name, wallet.seed);

  return { created: true, wallet };
}
