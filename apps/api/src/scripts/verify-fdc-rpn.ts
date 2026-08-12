import xrpl from "xrpl";
import {
  createPublicClient,
  decodeAbiParameters,
  decodeEventLog,
  http,
  isAddressEqual,
  isHex,
  type Hex,
} from "viem";

const rpcUrl = "https://coston2-api.flare.network/ext/C/rpc";
const xrplUrl = "wss://s.altnet.rippletest.net:51233";
const daUrl =
  "https://ctn2-data-availability.flare.network/api/v1/fdc/proof-by-request-round-raw";
const publicApiKey = "00000000-0000-0000-0000-000000000000";
const registry = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
const requestTransactionHash =
  "0xf0d64169f5d3cdf48975b8e5d76fcf812ee721baa22e589fbbe643436fc50e93";
const recipient = "rBrGGQy5GwFwL4fs9C2YFLquD5ZQYtj8Dw";
const expectedReference =
  "0x25694ffb6d0c4c84e34b0a46098a034111bda752785f542af64a391d7ad2915a";
const expectedDestinationHash =
  "0x388d4bc2ff8a615fb4f77413d064d649189f618fe8dd9fc68d5d9de4b6c42893";
const expectedAttestationType =
  "0x5265666572656e6365645061796d656e744e6f6e6578697374656e6365000000";
const expectedSourceId =
  "0x7465737458525000000000000000000000000000000000000000000000000000";
const zeroBytes32 = `0x${"00".repeat(32)}`;

const registryAbi = [
  {
    name: "getContractAddressByName",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "string" }],
    outputs: [{ type: "address" }],
  },
] as const;
const eventAbi = [
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
    { name: "minimalBlockNumber", type: "uint64" },
    { name: "deadlineBlockNumber", type: "uint64" },
    { name: "deadlineTimestamp", type: "uint64" },
    { name: "destinationAddressHash", type: "bytes32" },
    { name: "amount", type: "uint256" },
    { name: "standardPaymentReference", type: "bytes32" },
    { name: "checkSourceAddresses", type: "bool" },
    { name: "sourceAddressesRoot", type: "bytes32" },
  ],
} as const;
const responseBody = {
  name: "responseBody",
  type: "tuple",
  components: [
    { name: "minimalBlockTimestamp", type: "uint64" },
    { name: "firstOverflowBlockNumber", type: "uint64" },
    { name: "firstOverflowBlockTimestamp", type: "uint64" },
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
const verificationAbi = [
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
    name: "verifyReferencedPaymentNonexistence",
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
    outputs: [{ type: "bool" }],
  },
] as const;

type DaProof = { proof: Hex[]; response_hex: Hex };
function parseProof(value: unknown): DaProof {
  if (
    typeof value !== "object" ||
    value === null ||
    !("response_hex" in value) ||
    !isHex(value.response_hex) ||
    !("proof" in value) ||
    !Array.isArray(value.proof) ||
    !value.proof.every((node) => isHex(node, { strict: true }))
  ) {
    throw new Error("DA response does not match the documented raw schema");
  }
  return { proof: value.proof as Hex[], response_hex: value.response_hex };
}

const client = createPublicClient({ transport: http(rpcUrl) });
if ((await client.getChainId()) !== 114)
  throw new Error("Refusing to verify outside Coston2 chain ID 114");
const receipt = await client.getTransactionReceipt({
  hash: requestTransactionHash,
});
if (receipt.status !== "success") throw new Error("Request transaction failed");
const [fdcHub, systemsManager, fdcVerification] = await Promise.all(
  ["FdcHub", "FlareSystemsManager", "FdcVerification"].map((name) =>
    client.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "getContractAddressByName",
      args: [name],
    }),
  ),
);
const eventLog = receipt.logs.find((log) =>
  isAddressEqual(log.address, fdcHub),
);
if (!eventLog) throw new Error("Confirmed receipt has no FdcHub log");
const event = decodeEventLog({
  abi: eventAbi,
  data: eventLog.data,
  topics: eventLog.topics,
});
if (event.eventName !== "AttestationRequest" || event.args.fee !== 1_000n)
  throw new Error("AttestationRequest event or fee mismatch");
const block = await client.getBlock({ blockNumber: receipt.blockNumber });
const [roundStart, roundDuration, relay, protocolId] = await Promise.all([
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
    abi: verificationAbi,
    functionName: "relay",
  }),
  client.readContract({
    address: fdcVerification,
    abi: verificationAbi,
    functionName: "fdcProtocolId",
  }),
]);
const votingRound = (block.timestamp - roundStart) / BigInt(roundDuration);
const finalized = await client.readContract({
  address: relay,
  abi: relayAbi,
  functionName: "isFinalized",
  args: [BigInt(protocolId), votingRound],
});
if (!finalized) throw new Error(`Voting round ${votingRound} is not finalized`);

const daResponse = await fetch(daUrl, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    "x-api-key": publicApiKey,
  },
  body: JSON.stringify({
    votingRoundId: Number(votingRound),
    requestBytes: event.args.data,
  }),
  signal: AbortSignal.timeout(60_000),
});
if (!daResponse.ok) throw new Error(`DA service returned ${daResponse.status}`);
const proof = parseProof(await daResponse.json());
const decoded = decodeAbiParameters([responseParameter], proof.response_hex)[0];

const xrplClient = new xrpl.Client(xrplUrl, { connectionTimeout: 30_000 });
await xrplClient.connect();
const ledgers = await Promise.all(
  [19830792, 19830793, 19830794].map(async (ledger_index) =>
    xrplClient.request({
      command: "ledger",
      ledger_index,
      transactions: true,
      expand: true,
    }),
  ),
);
const history = await xrplClient.request({
  command: "account_tx",
  account: recipient,
  ledger_index_min: 19830792,
  ledger_index_max: 19830793,
  binary: false,
  forward: true,
  limit: 400,
});
await xrplClient.disconnect();
const matches = history.result.transactions.filter((entry) => {
  const transaction = entry.tx_json;
  const metadata = entry.meta;
  if (!transaction || typeof metadata !== "object") return false;
  const memo =
    transaction.Memos?.length === 1
      ? transaction.Memos[0]?.Memo?.MemoData
      : undefined;
  const delivered = metadata.delivered_amount;
  return (
    transaction.TransactionType === "Payment" &&
    transaction.Destination === recipient &&
    typeof transaction.Amount === "string" &&
    BigInt(transaction.Amount) >= 1_000_000n &&
    typeof delivered === "string" &&
    BigInt(delivered) >= 1_000_000n &&
    memo?.toLowerCase() === expectedReference.slice(2)
  );
});
const minimalLedger = ledgers[0].result.ledger;
const overflowLedger = ledgers[2].result.ledger;
const checks = {
  attestationType: decoded.attestationType === expectedAttestationType,
  sourceId: decoded.sourceId === expectedSourceId,
  votingRound: decoded.votingRound === votingRound,
  lowestUsedTimestamp: decoded.lowestUsedTimestamp === 1_786_485_851n,
  minimalBlockNumber: decoded.requestBody.minimalBlockNumber === 19_830_792n,
  deadlineBlockNumber: decoded.requestBody.deadlineBlockNumber === 19_830_793n,
  deadlineTimestamp: decoded.requestBody.deadlineTimestamp === 1_786_485_860n,
  destination:
    decoded.requestBody.destinationAddressHash === expectedDestinationHash,
  amount: decoded.requestBody.amount === 1_000_000n,
  reference: decoded.requestBody.standardPaymentReference === expectedReference,
  sourceCheckDisabled: !decoded.requestBody.checkSourceAddresses,
  sourceRootZero: decoded.requestBody.sourceAddressesRoot === zeroBytes32,
  minimalBlockTimestamp:
    decoded.responseBody.minimalBlockTimestamp ===
    BigInt(minimalLedger.close_time + 946_684_800),
  overflowBlockNumber:
    decoded.responseBody.firstOverflowBlockNumber === 19_830_794n,
  overflowBlockTimestamp:
    decoded.responseBody.firstOverflowBlockTimestamp ===
    BigInt(overflowLedger.close_time + 946_684_800),
  noMatchingPayment: matches.length === 0,
};
if (Object.values(checks).some((passed) => !passed))
  throw new Error(`RPN proof mismatch: ${JSON.stringify(checks)}`);
const verified = await client.readContract({
  address: fdcVerification,
  abi: verificationAbi,
  functionName: "verifyReferencedPaymentNonexistence",
  args: [{ merkleProof: proof.proof, data: decoded }],
});
if (!verified) throw new Error("RPN proof verification returned false");
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
