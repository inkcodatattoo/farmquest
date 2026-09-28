export function quickSellPayout(input: Readonly<{
  quantity: bigint;
  unitPrice: bigint;
  sellMultiplierBps: bigint;
  feeBps: bigint;
}>): Readonly<{ grossAdjusted: bigint; fee: bigint; payout: bigint }> {
  const { quantity, unitPrice, sellMultiplierBps, feeBps } = input;

  if (quantity <= 0n || unitPrice < 0n) throw new Error("INVALID_SELL_INPUT");
  if (sellMultiplierBps < 0n) throw new Error("INVALID_MULTIPLIER");
  if (feeBps < 0n || feeBps > 10_000n) throw new Error("INVALID_FEE_BPS");

  const grossAdjusted =
    (quantity * unitPrice * sellMultiplierBps) / 10_000n;
  const fee = (grossAdjusted * feeBps) / 10_000n;
  const payout = grossAdjusted - fee;

  return { grossAdjusted, fee, payout };
}
