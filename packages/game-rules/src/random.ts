import { randomInt } from "node:crypto";

export interface RandomSource {
  int(minInclusive: number, maxExclusive: number): number;
}

export class CryptoRandomSource implements RandomSource {
  int(minInclusive: number, maxExclusive: number): number {
    return randomInt(minInclusive, maxExclusive);
  }
}

export type WeightedEntry<T> = {
  value: T;
  weight: number;
};

export function drawWeighted<T>(
  entries: readonly WeightedEntry<T>[],
  random: RandomSource
): T {
  const valid = entries.filter((entry) => Number.isInteger(entry.weight) && entry.weight > 0);

  if (valid.length === 0) {
    throw new Error("WEIGHTED_DRAW_REQUIRES_POSITIVE_WEIGHTS");
  }

  const total = valid.reduce((sum, entry) => sum + entry.weight, 0);
  const draw = random.int(0, total);

  let cumulative = 0;
  for (const entry of valid) {
    cumulative += entry.weight;
    if (draw < cumulative) return entry.value;
  }

  throw new Error("WEIGHTED_DRAW_INVARIANT_BROKEN");
}
