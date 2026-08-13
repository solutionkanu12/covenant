import {
  createPublicClient,
  getAddress,
  http,
  isAddressEqual,
  type Address,
} from "viem";

const COSTON2_CHAIN_ID = 114;
const COSTON2_RPC_URL =
  process.env.COSTON2_RPC_URL ?? "https://coston2-api.flare.network/ext/C/rpc";
const FLARE_CONTRACT_REGISTRY = getAddress(
  "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019",
);
// Official Coston2 FAssets deployment. Do not substitute a token with the same
// name/symbol: CovenantEscrow deliberately supports only this non-rebasing token.
const OFFICIAL_COSTON2_FTESTXRP = getAddress(
  "0x0b6A3645c240605887a5532109323A3E12273dc7",
);

const configuredToken = requiredAddress("COVENANT_COLLATERAL_TOKEN");
const configuredVerifier = requiredAddress("COVENANT_FDC_VERIFICATION");
const client = createPublicClient({ transport: http(COSTON2_RPC_URL) });
const registryAbi = [
  {
    type: "function",
    name: "getContractAddressByName",
    stateMutability: "view",
    inputs: [{ name: "_name", type: "string" }],
    outputs: [{ name: "_address", type: "address" }],
  },
] as const;

const chainId = await client.getChainId();
if (chainId !== COSTON2_CHAIN_ID) {
  throw new Error(`Expected Coston2 chain ID 114, received ${chainId}`);
}
const officialVerifier = await client.readContract({
  address: FLARE_CONTRACT_REGISTRY,
  abi: registryAbi,
  functionName: "getContractAddressByName",
  args: ["FdcVerification"],
});
if (!isAddressEqual(configuredToken, OFFICIAL_COSTON2_FTESTXRP)) {
  throw new Error(
    `Collateral must be official Coston2 FTestXRP ${OFFICIAL_COSTON2_FTESTXRP}; received ${configuredToken}`,
  );
}
if (!isAddressEqual(configuredVerifier, officialVerifier)) {
  throw new Error(
    `FDC verifier must equal the current official registry value ${officialVerifier}; received ${configuredVerifier}`,
  );
}
const [tokenCode, verifierCode] = await Promise.all([
  client.getCode({ address: configuredToken }),
  client.getCode({ address: configuredVerifier }),
]);
if (
  !tokenCode ||
  tokenCode === "0x" ||
  !verifierCode ||
  verifierCode === "0x"
) {
  throw new Error(
    "Configured official dependencies must contain deployed code",
  );
}

console.log(
  JSON.stringify({
    chainId,
    collateralToken: configuredToken,
    fdcVerification: configuredVerifier,
    status: "deployment-preflight-ok",
  }),
);

function requiredAddress(name: string): Address {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return getAddress(value);
}
