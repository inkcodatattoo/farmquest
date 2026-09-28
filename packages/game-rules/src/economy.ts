export function applyBps(value: bigint, bps: bigint): bigint {
  if (value < 0n) throw new Error("VALUE_MUST_BE_NON_NEGATIVE");
  if (bps < 0n) throw new Error("BPS_MUST_BE_NON_NEGATIVE");
  return (value * bps) / 10_000n;
}

export function quickSellValues(input: Readonly<{
  quantity: bigint;
  unitBasePrice: bigint;
  qualitySellMultiplierBps: bigint;
  feeBps: bigint;
}>): Readonly<{
  grossValue: bigint;
  feeValue: bigint;
  payout: bigint;
}> {
  const {
    quantity,
    unitBasePrice,
    qualitySellMultiplierBps,
    feeBps
  } = input;

  if (quantity <= 0n) throw new Error("QUANTITY_MUST_BE_POSITIVE");
  if (unitBasePrice < 0n) throw new Error("PRICE_MUST_BE_NON_NEGATIVE");
  if (qualitySellMultiplierBps < 0n) {
    throw new Error("MULTIPLIER_MUST_BE_NON_NEGATIVE");
  }
  if (feeBps < 0n || feeBps > 10_000n) {
    throw new Error("FEE_BPS_OUT_OF_RANGE");
  }

  const base = quantity * unitBasePrice;
  const grossValue = applyBps(base, qualitySellMultiplierBps);
  const feeValue = applyBps(grossValue, feeBps);
  const payout = grossValue - feeValue;

  return { grossValue, feeValue, payout };
}

export function stackSlots(quantity: bigint, stackLimit: bigint): number {
  if (quantity < 0n) throw new Error("QUANTITY_MUST_BE_NON_NEGATIVE");
  if (stackLimit <= 0n) throw new Error("STACK_LIMIT_MUST_BE_POSITIVE");
  if (quantity === 0n) return 0;
  return Number((quantity + stackLimit - 1n) / stackLimit);
}
