/** Shorten a hex address or hash for display: 0x1234…abcd. */
export function truncateHex(value: string, visible = 4): string {
  if (!value.startsWith("0x") || value.length <= 2 + visible * 2) {
    return value;
  }
  return `${value.slice(0, 2 + visible)}…${value.slice(-visible)}`;
}

/** Render a whole-token amount with trimming, e.g. 12.5 or 0.02. */
export function formatTokenAmount(
  value: bigint,
  decimals: number,
  maximumFractionDigits = 4,
): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = absolute % base;
  if (fraction === 0n || maximumFractionDigits === 0) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }
  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, "");
  if (fractionText.length === 0) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }
  return `${negative ? "-" : ""}${whole.toString()}.${fractionText}`;
}
