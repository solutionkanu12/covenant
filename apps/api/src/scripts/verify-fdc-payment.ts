import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  createPublicClient,
  decodeAbiParameters,
  decodeEventLog,
  http,
  isAddressEqual,
  isHex,
  keccak256,
  toBytes,
  type Hex,
} from "viem";

const chainId = 114;
const rpcUrl = "https://coston2-api.flare.network/ext/C/rpc";
const daUrl =
  "https://ctn2-data-availability.flare.network/api/v1/fdc/proof-by-request-round-raw";
const publicVerifierApiKey = "00000000-0000-0000-0000-000000000000";
const registry = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
const requestTransactionHash =
  "0x2939b950f732b1cbdc182ad4f502e1034934d60a30947a1011e60242b8394017";
const expectedAttestationType =
  "0x5061796d656e7400000000000000000000000000000000000000000000000000";
const expectedSourceId =
  "0x7465737458525000000000000000000000000000000000000000000000000000";

const registryAbi = [
  {
    name: "getContractAddressByName",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_name", type: "string" }],
    outputs: [{ name: "_address", type: "address" }],
  },
] as const;
const fdcHubAbi = [
  {
    name: "AttestationRequest",
    type: "event",
    inputs: [
      { name: "data", type: "bytes", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
] as const;
const systemsManagerAbi = [
  {
    name: "firstVotingRoundStartTs",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    name: "votingEpochDurationSeconds",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint32" }],
  },
] as const;
const relayAbi = [
  {
    name: "isFinalized",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;
const requestBody = {
  name: "requestBody",
  type: "tuple",
  components: [
    { name: "transactionId", type: "bytes32" },
    { name: "inUtxo", type: "uint256" },
    { name: "utxo", type: "uint256" },
  ],
} as const;
const responseBody = {
  name: "responseBody",
  type: "tuple",
  components: [
    { name: "blockNumber", type: "uint64" },
    { name: "blockTimestamp", type: "uint64" },
    { name: "sourceAddressHash", type: "bytes32" },
    { name: "sourceAddressesRoot", type: "bytes32" },
    { name: "receivingAddressHash", type: "bytes32" },
    { name: "intendedReceivingAddressHash", type: "bytes32" },
    { name: "spentAmount", type: "int256" },
    { name: "intendedSpentAmount", type: "int256" },
    { name: "receivedAmount", type: "int256" },
    { name: "intendedReceivedAmount", type: "int256" },
    { name: "standardPaymentReference", type: "bytes32" },
    { name: "oneToOne", type: "bool" },
    { name: "status", type: "uint8" },
  ],
} as const;
const responseParameter = {
  name: "data",
  type: "tuple",
  components: [
    { name: "attestationType", type: "bytes32" },
    { name: "sourceId", type: "bytes32" },
    { name: "votingRound", type: "uint64" },
    { name: "lowestUsedTimestamp", type: "uint64" },
    requestBody,
    responseBody,
  ],
} as const;
const fdcVerificationAbi = [
  {
    name: "fdcProtocolId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "relay",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "verifyPayment",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "_proof",
        type: "tuple",
        components: [
          { name: "merkleProof", type: "bytes32[]" },
          responseParameter,
        ],
      },
    ],
    outputs: [{ name: "_proved", type: "bool" }],
  },
] as const;

type Phase1BFixture = {
  destinationAddress: string;
  ledgerIndex: number;
  payerAddress: string;
  reference: string;
  transactionHash: string;
};
type DaProof = { proof: Hex[]; response_hex: Hex };

function parseDaProof(value: unknown): DaProof {
  if (
    typeof value !== "object" ||
    value === null ||
    !("response_hex" in value) ||
    !isHex(value.response_hex) ||
    !("proof" in value) ||
    !Array.isArray(value.proof) ||
    !value.proof.every((item) => isHex(item, { strict: true }))
  ) {
    throw new Error(
      "DA response does not match the documented raw proof schema",
    );
  }
  return { proof: value.proof as Hex[], response_hex: value.response_hex };
}

const fixturePath = fileURLToPath(
  new URL("../../fixtures/phase-1b-xrpl-payment.json", import.meta.url),
);
const fixture = JSON.parse(
  await readFile(fixturePath, "utf8"),
) as Phase1BFixture;
const client = createPublicClient({ transport: http(rpcUrl) });

if ((await client.getChainId()) !== chainId) {
  throw new Error("Refusing to verify outside Coston2 chain ID 114");
}

const receipt = await client.getTransactionReceipt({
  hash: requestTransactionHash,
});
if (receipt.status !== "success") {
  throw new Error("FDC request transaction is not successful");
}
const fdcHub = await client.readContract({
  address: registry,
  abi: registryAbi,
  functionName: "getContractAddressByName",
  args: ["FdcHub"],
});
const eventLog = receipt.logs.find((log) =>
  isAddressEqual(log.address, fdcHub),
);
if (!eventLog) throw new Error("Confirmed receipt has no FdcHub log");
const event = decodeEventLog({
  abi: fdcHubAbi,
  data: eventLog.data,
  topics: eventLog.topics,
});
if (event.eventName !== "AttestationRequest" || event.args.fee !== 1_000n) {
  throw new Error("Confirmed AttestationRequest event or fee is invalid");
}

const [systemsManager, fdcVerification] = await Promise.all([
  client.readContract({
    address: registry,
    abi: registryAbi,
    functionName: "getContractAddressByName",
    args: ["FlareSystemsManager"],
  }),
  client.readContract({
    address: registry,
    abi: registryAbi,
    functionName: "getContractAddressByName",
    args: ["FdcVerification"],
  }),
]);
const block = await client.getBlock({ blockNumber: receipt.blockNumber });
const [firstRoundStart, roundDuration, relay, protocolId] = await Promise.all([
  client.readContract({
    address: systemsManager,
    abi: systemsManagerAbi,
    functionName: "firstVotingRoundStartTs",
  }),
  client.readContract({
    address: systemsManager,
    abi: systemsManagerAbi,
    functionName: "votingEpochDurationSeconds",
  }),
  client.readContract({
    address: fdcVerification,
    abi: fdcVerificationAbi,
    functionName: "relay",
  }),
  client.readContract({
    address: fdcVerification,
    abi: fdcVerificationAbi,
    functionName: "fdcProtocolId",
  }),
]);
const votingRound = (block.timestamp - firstRoundStart) / BigInt(roundDuration);
const finalized = await client.readContract({
  address: relay,
  abi: relayAbi,
  functionName: "isFinalized",
  args: [BigInt(protocolId), votingRound],
});
if (!finalized)
  throw new Error(`FDC voting round ${votingRound} is not finalized`);

const daResponse = await fetch(daUrl, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    "x-api-key": publicVerifierApiKey,
  },
  body: JSON.stringify({
    requestBytes: event.args.data,
    votingRoundId: Number(votingRound),
  }),
  signal: AbortSignal.timeout(60_000),
});
if (!daResponse.ok)
  throw new Error(`DA service returned HTTP ${daResponse.status}`);
const proof = parseDaProof(await daResponse.json());
const decoded = decodeAbiParameters([responseParameter], proof.response_hex)[0];
const payerHash = keccak256(toBytes(fixture.payerAddress));
const destinationHash = keccak256(toBytes(fixture.destinationAddress));
const checks = {
  attestationType: decoded.attestationType === expectedAttestationType,
  sourceId: decoded.sourceId === expectedSourceId,
  votingRound: decoded.votingRound === votingRound,
  transactionId:
    decoded.requestBody.transactionId.toLowerCase() ===
    `0x${fixture.transactionHash}`.toLowerCase(),
  inUtxo: decoded.requestBody.inUtxo === 0n,
  utxo: decoded.requestBody.utxo === 0n,
  ledger: decoded.responseBody.blockNumber === BigInt(fixture.ledgerIndex),
  payer:
    decoded.responseBody.sourceAddressHash.toLowerCase() ===
    payerHash.toLowerCase(),
  destination:
    decoded.responseBody.receivingAddressHash.toLowerCase() ===
      destinationHash.toLowerCase() &&
    decoded.responseBody.intendedReceivingAddressHash.toLowerCase() ===
      destinationHash.toLowerCase(),
  delivered:
    decoded.responseBody.receivedAmount === 1_000_000n &&
    decoded.responseBody.intendedReceivedAmount === 1_000_000n,
  reference:
    decoded.responseBody.standardPaymentReference.toLowerCase() ===
    `0x${fixture.reference}`.toLowerCase(),
  oneToOne: decoded.responseBody.oneToOne,
  status: decoded.responseBody.status === 0,
};
if (Object.values(checks).some((passed) => !passed)) {
  throw new Error(`FDC Payment proof mismatch: ${JSON.stringify(checks)}`);
}
const verified = await client.readContract({
  address: fdcVerification,
  abi: fdcVerificationAbi,
  functionName: "verifyPayment",
  args: [{ merkleProof: proof.proof, data: decoded }],
});
if (!verified) throw new Error("FdcVerification.verifyPayment returned false");

console.log(
  JSON.stringify(
    {
      checks,
      fdcHub,
      fdcVerification,
      requestTransactionHash,
      verified,
      votingRound,
    },
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
  ),
);
