const baseUrl =
  process.env.FDC_VERIFIER_URL ??
  "https://fdc-verifiers-testnet.flare.network/verifier/xrp";
const endpoint = `${baseUrl.replace(/\/$/, "")}/api-doc`;

try {
  const response = await fetch(endpoint, {
    headers: { accept: "text/html,application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Verifier returned HTTP ${response.status}`);
  }

  console.log(
    JSON.stringify({
      contentType: response.headers.get("content-type"),
      endpoint,
      httpStatus: response.status,
      reachable: true,
    }),
  );
} catch (error) {
  console.error("FDC verifier reachability check failed", error);
  process.exitCode = 1;
}
