export type SupabaseConfig = {
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
};

export type XamanConfig = { apiKey: string; apiSecret: string };

export type BackendConfig = SupabaseConfig & {
  coston2RpcUrl: string;
  internalApiSecret: string;
  indexerStartBlock: bigint;
  indexerBatchSize: bigint;
  indexerPollIntervalMs: number;
  xrplTestnetUrl: string;
  xaman?: XamanConfig;
};

const expectedXrplTestnetUrl = "wss://s.altnet.rippletest.net:51233";

export function loadSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseConfig {
  const url = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey)
    throw new Error("Missing required Supabase server configuration");
  return { url: new URL(url).origin, publishableKey, serviceRoleKey };
}

export function loadBackendConfig(
  env: NodeJS.ProcessEnv = process.env,
): BackendConfig {
  const supabase = loadSupabaseConfig(env);
  const coston2RpcUrl = env.COSTON2_RPC_URL;
  const internalApiSecret = env.INTERNAL_API_SECRET;
  if (!coston2RpcUrl || !internalApiSecret)
    throw new Error("Missing required backend service configuration");
  const indexerStartBlock = BigInt(env.INDEXER_START_BLOCK ?? "34013106");
  // The public Coston2 RPC (coston2-api.flare.network) caps eth_getLogs at 30 blocks per call.
  const indexerBatchSize = BigInt(env.INDEXER_BATCH_SIZE ?? "25");
  const indexerPollIntervalMs = Number(env.INDEXER_POLL_INTERVAL_MS ?? "15000");
  if (
    indexerStartBlock < 0n ||
    indexerBatchSize < 1n ||
    indexerBatchSize > 10_000n
  )
    throw new Error("Invalid indexer block configuration");
  if (!Number.isInteger(indexerPollIntervalMs) || indexerPollIntervalMs < 5_000)
    throw new Error("Invalid indexer poll interval");
  const xrplTestnetUrl = env.XRPL_TESTNET_URL ?? expectedXrplTestnetUrl;
  if (xrplTestnetUrl !== expectedXrplTestnetUrl)
    throw new Error(
      `Phase 6 is locked to XRPL Testnet at ${expectedXrplTestnetUrl}; refusing ${xrplTestnetUrl}`,
    );
  const xamanApiKey = env.XAMAN_API_KEY;
  const xamanApiSecret = env.XAMAN_API_SECRET;
  const xaman =
    xamanApiKey && xamanApiSecret
      ? { apiKey: xamanApiKey, apiSecret: xamanApiSecret }
      : undefined;
  return {
    ...supabase,
    coston2RpcUrl: new URL(coston2RpcUrl).toString(),
    internalApiSecret,
    indexerStartBlock,
    indexerBatchSize,
    indexerPollIntervalMs,
    xrplTestnetUrl,
    xaman,
  };
}
