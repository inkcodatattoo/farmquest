import { describe, expect, it } from "vitest";
import { drawWeighted, type RandomSource } from "../src/random.js";

class FixedRandom implements RandomSource {
  constructor(private readonly value: number) {}

  int(minInclusive: number, maxExclusive: number): number {
    if (this.value < minInclusive || this.value >= maxExclusive) {
      throw new Error("FIXED_RANDOM_OUT_OF_RANGE");
    }
    return this.value;
  }
}

describe("drawWeighted", () => {
  const entries = [
    { value: "COMMON", weight: 7000 },
    { value: "GOOD", weight: 2500 },
    { value: "EXCELLENT", weight: 490 },
    { value: "EXTRAORDINARY", weight: 10 }
  ] as const;

  it("uses deterministic cumulative integer weights", () => {
    expect(drawWeighted(entries, new FixedRandom(0))).toBe("COMMON");
    expect(drawWeighted(entries, new FixedRandom(7000))).toBe("GOOD");
    expect(drawWeighted(entries, new FixedRandom(9500))).toBe("EXCELLENT");
    expect(drawWeighted(entries, new FixedRandom(9999))).toBe("EXTRAORDINARY");
  });

  it("rejects a table without positive weights", () => {
    expect(() =>
      drawWeighted([{ value: "x", weight: 0 }], new FixedRandom(0))
    ).toThrow("WEIGHTED_DRAW_REQUIRES_POSITIVE_WEIGHTS");
  });
});
