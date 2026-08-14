import {
  createPublicClient,
  createWalletClient,
  http,
  isAddressEqual,
  isHex,
  decodeAbiParameters,
  decodeEventLog,
  type Address,
  type Hex,
  type PublicClient,
  type AbiParameterToPrimitiveType,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { flareContractRegistry, fdcDataAvailabilityUrl } from "./constants.js";

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
    name: "requestAttestation",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "_data", type: "bytes" }],
    outputs: [],
  },
  {
    name: "AttestationRequest",
    type: "event",
    inputs: [
      { name: "data", type: "bytes", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
] as const;
const feeConfigAbi = [
  {
    name: "getRequestFee",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_data", type: "bytes" }],
    outputs: [{ name: "", type: "uint256" }],
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
] as const;

const requestBodyType = {
  name: "requestBody",
  type: "tuple",
  components: [
    { name: "transactionId", type: "bytes32" },
    { name: "inUtxo", type: "uint256" },
    { name: "utxo", type: "uint256" },
  ],
} as const;
const paymentResponseBody = {
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
const paymentResponseParameter = {
  name: "data",
  type: "tuple",
  components: [
    { name: "attestationType", type: "bytes32" },
    { name: "sourceId", type: "bytes32" },
    { name: "votingRound", type: "uint64" },
    { name: "lowestUsedTimestamp", type: "uint64" },
    requestBodyType,
    paymentResponseBody,
  ],
} as const;

const rpnRequestBodyType = {
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
const rpnResponseBody = {
  name: "responseBody",
  type: "tuple",
  components: [
    { name: "minimalBlockTimestamp", type: "uint64" },
    { name: "firstOverflowBlockNumber", type: "uint64" },
    { name: "firstOverflowBlockTimestamp", type: "uint64" },
  ],
} as const;
const rpnResponseParameter = {
  name: "data",
  type: "tuple",
  components: [
    { name: "attestationType", type: "bytes32" },
    { name: "sourceId", type: "bytes32" },
    { name: "votingRound", type: "uint64" },
    { name: "lowestUsedTimestamp", type: "uint64" },
    rpnRequestBodyType,
    rpnResponseBody,
  ],
} as const;

export type PaymentProofData = AbiParameterToPrimitiveType<
  typeof paymentResponseParameter
>;
export type RpnProofData = AbiParameterToPrimitiveType<
  typeof rpnResponseParameter
>;

export type DaProof = { proof: Hex[]; responseHex: Hex };

function parseDaProof(value: unknown): DaProof {
  if (
    typeof value !== "object" ||
    value === null ||
    !("response_hex" in value) ||
    !isHex((value as { response_hex: unknown }).response_hex) ||
    !("proof" in value) ||
    !Array.isArray((value as { proof: unknown }).proof) ||
    !(value as { proof: unknown[] }).proof.every(
      (item) => isHex(item, { strict: true }),
    )
  )
    throw new Error("DA response does not match the documented raw proof schema");
  const typed = value as { proof: Hex[]; response_hex: Hex };
  return { proof: typed.proof, responseHex: typed.response_hex };
}

export function createCoston2FdcClient(
  rpcUrl: string,
  executorPrivateKey?: Hex,
) {
  const client = createPublicClient({ transport: http(rpcUrl, { timeout: 20_000 }) });
  const account = executorPrivateKey
    ? privateKeyToAccount(executorPrivateKey)
    : undefined;
  const wallet = account
    ? createWalletClient({ account, transport: http(rpcUrl, { timeout: 20_000 }) })
    : undefined;

  async function resolve(name: string): Promise<Address> {
    return client.readContract({
      address: flareContractRegistry,
      abi: registryAbi,
      functionName: "getContractAddressByName",
      args: [name],
    });
  }

  async function deriveVotingRound(blockTimestamp: bigint): Promise<bigint> {
    const systemsManager = await resolve("FlareSystemsManager");
    const [firstRoundStart, roundDuration] = await Promise.all([
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
    ]);
    return (blockTimestamp - firstRoundStart) / BigInt(roundDuration);
  }

  return {
    publicClient: client as PublicClient,

    /** Submits the abi-encoded request to FdcHub. Requires a configured executor key. */
    async submitRequest(abiEncodedRequest: Hex) {
      if (!wallet || !account)
        throw new Error("EXECUTOR_KEY_MISSING");
      const fdcHub = await resolve("FdcHub");
      const feeConfig = await resolve("FdcRequestFeeConfigurations");
      const fee = await client.readContract({
        address: feeConfig,
        abi: feeConfigAbi,
        functionName: "getRequestFee",
        args: [abiEncodedRequest],
      });
      const hash = await wallet.writeContract({
        address: fdcHub,
        abi: fdcHubAbi,
        functionName: "requestAttestation",
        args: [abiEncodedRequest],
        value: fee,
        account,
        chain: undefined,
      });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success")
        throw new Error("FDC attestation request transaction failed");
      const fdcHubLog = receipt.logs.find((log) => isAddressEqual(log.address, fdcHub));
      if (!fdcHubLog) throw new Error("Attestation request receipt has no FdcHub log");
      const event = decodeEventLog({
        abi: fdcHubAbi,
        data: fdcHubLog.data,
        topics: fdcHubLog.topics,
      });
      if (event.eventName !== "AttestationRequest")
        throw new Error("Unexpected FdcHub event");
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      const roundId = await deriveVotingRound(block.timestamp);
      return { requestTxHash: hash, roundId };
    },

    /** Derives the voting round for a request confirmed with the given block timestamp. */
    deriveVotingRound,

    async isRoundFinalized(roundId: bigint) {
      const fdcVerification = await resolve("FdcVerification");
      const [relay, protocolId] = await Promise.all([
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
      return client.readContract({
        address: relay,
        abi: relayAbi,
        functionName: "isFinalized",
        args: [BigInt(protocolId), roundId],
      });
    },

    async fetchProof(requestBytes: Hex, roundId: bigint) {
      const response = await fetch(fdcDataAvailabilityUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-api-key": "00000000-0000-0000-0000-000000000000",
        },
        body: JSON.stringify({
          requestBytes,
          votingRoundId: Number(roundId),
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok)
        throw new Error(`DA service returned HTTP ${response.status}`);
      return parseDaProof(await response.json());
    },

    decodePaymentProof(responseHex: Hex): PaymentProofData {
      return decodeAbiParameters([paymentResponseParameter], responseHex)[0];
    },

    decodeRpnProof(responseHex: Hex): RpnProofData {
      return decodeAbiParameters([rpnResponseParameter], responseHex)[0];
    },

    /** Submits a decoded Payment proof to CovenantEscrow.settlePaid. Requires an executor key. */
    async settlePaid(
      contractAddress: Address,
      commitmentId: bigint,
      merkleProof: readonly Hex[],
      data: PaymentProofData,
    ) {
      if (!wallet || !account) throw new Error("EXECUTOR_KEY_MISSING");
      const abi = [
        {
          name: "settlePaid",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "commitmentId", type: "uint256" },
            {
              name: "proof",
              type: "tuple",
              components: [
                { name: "merkleProof", type: "bytes32[]" },
                paymentResponseParameter,
              ],
            },
          ],
          outputs: [],
        },
      ] as const;
      const hash = await wallet.writeContract({
        address: contractAddress,
        abi,
        functionName: "settlePaid",
        args: [commitmentId, { merkleProof, data }],
        account,
        chain: undefined,
      });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success")
        throw new Error("settlePaid transaction failed");
      return hash;
    },

    /** Submits a decoded RPN proof to CovenantEscrow.settleDefault. Requires an executor key. */
    async settleDefault(
      contractAddress: Address,
      commitmentId: bigint,
      merkleProof: readonly Hex[],
      data: RpnProofData,
    ) {
      if (!wallet || !account) throw new Error("EXECUTOR_KEY_MISSING");
      const abi = [
        {
          name: "settleDefault",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "commitmentId", type: "uint256" },
            {
              name: "proof",
              type: "tuple",
              components: [
                { name: "merkleProof", type: "bytes32[]" },
                rpnResponseParameter,
              ],
            },
          ],
          outputs: [],
        },
      ] as const;
      const hash = await wallet.writeContract({
        address: contractAddress,
        abi,
        functionName: "settleDefault",
        args: [commitmentId, { merkleProof, data }],
        account,
        chain: undefined,
      });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success")
        throw new Error("settleDefault transaction failed");
      return hash;
    },
  };
}

export type Coston2FdcClient = ReturnType<typeof createCoston2FdcClient>;
