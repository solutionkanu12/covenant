import { createPublicClient, http } from "viem";

const expectedChainId = 114;
const endpoint =
  process.env.COSTON2_RPC_URL ?? "https://coston2-api.flare.network/ext/C/rpc";
const client = createPublicClient({
  transport: http(endpoint, { timeout: 15_000 }),
});

try {
  const [chainId, latestBlock, clientVersion] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
    client.request({ method: "web3_clientVersion" }),
  ]);

  if (chainId !== expectedChainId) {
    throw new Error(
      `Expected Coston2 chain ID ${expectedChainId}, received ${chainId}`,
    );
  }

  console.log(
    JSON.stringify({
      chainId,
      clientVersion,
      endpoint,
      latestBlock: latestBlock.toString(),
      rpcHealth: "ok",
    }),
  );
} catch (error) {
  console.error("Coston2 network check failed", error);
  process.exitCode = 1;
}
