export type QuickSellResult = Readonly<{
  grossValue: bigint;
  feeValue: bigint;
  payout: bigint;
}>;

export function calculateQuickSell(input: Readonly<{
  quantity: bigint;
  unitPrice: bigint;
  sellMultiplierBps: bigint;
  feeBps: bigint;
}>): QuickSellResult {
  const {
    quantity,
    unitPrice,
    sellMultiplierBps,
    feeBps
  } = input;

  if (quantity <= 0n) throw new Error("SELL_QUANTITY_INVALID");
  if (unitPrice < 0n) throw new Error("SELL_PRICE_INVALID");
  if (sellMultiplierBps < 0n) throw new Error("SELL_MULTIPLIER_INVALID");
  if (feeBps < 0n || feeBps > 10_000n) {
    throw new Error("SELL_FEE_INVALID");
  }

  const denominator = 10_000n * 10_000n;
  const payout =
    quantity *
    unitPrice *
    sellMultiplierBps *
    (10_000n - feeBps) /
    denominator;

  const grossValue =
    quantity *
    unitPrice *
    sellMultiplierBps /
    10_000n;

  const feeValue = grossValue - payout;

  return {
    grossValue,
    feeValue,
    payout
  };
}
