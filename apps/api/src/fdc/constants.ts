import { stringToHex, type Hex } from "viem";

export const flareContractRegistry: `0x${string}` =
  "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

export const fdcVerifierBaseUrl =
  process.env.FDC_VERIFIER_URL ??
  "https://fdc-verifiers-testnet.flare.network/verifier/xrp";
export const fdcDataAvailabilityUrl =
  "https://ctn2-data-availability.flare.network/api/v1/fdc/proof-by-request-round-raw";
/** Flare's published, non-secret public verifier API key for the testnet FDC verifiers. */
export const fdcPublicVerifierApiKey = "00000000-0000-0000-0000-000000000000";

export const paymentAttestationType: Hex = stringToHex("Payment", { size: 32 });
export const rpnAttestationType: Hex = stringToHex(
  "ReferencedPaymentNonexistence",
  { size: 32 },
);
export const testXrpSourceId: Hex = stringToHex("testXRP", { size: 32 });
