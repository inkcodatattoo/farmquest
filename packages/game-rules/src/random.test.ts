import { describe, expect, it } from "vitest";
import { drawWeighted, type RandomSource } from "./random.js";

class FixedRandom implements RandomSource {
  constructor(private readonly value: number) {}
  int(minInclusive: number, maxExclusive: number): number {
    expect(this.value).toBeGreaterThanOrEqual(minInclusive);
    expect(this.value).toBeLessThan(maxExclusive);
    return this.value;
  }
}

describe("drawWeighted", () => {
  it("is deterministic with injected randomness", () => {
    const entries = [
      { value: "COMMON", weight: 7000 },
      { value: "GOOD", weight: 2500 },
      { value: "EXCELLENT", weight: 490 },
      { value: "EXTRAORDINARY", weight: 10 }
    ] as const;

    expect(drawWeighted(entries, new FixedRandom(0))).toBe("COMMON");
    expect(drawWeighted(entries, new FixedRandom(7000))).toBe("GOOD");
    expect(drawWeighted(entries, new FixedRandom(9999))).toBe("EXTRAORDINARY");
  });
});
