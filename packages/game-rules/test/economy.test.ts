import { describe, expect, it } from "vitest";
import { quickSellValues, stackSlots } from "../src/economy.js";

describe("quickSellValues", () => {
  it("uses integer math and applies the 2% fee after quality", () => {
    expect(
      quickSellValues({
        quantity: 10n,
        unitBasePrice: 10n,
        qualitySellMultiplierBps: 12_500n,
        feeBps: 200n
      })
    ).toEqual({
      grossValue: 125n,
      feeValue: 2n,
      payout: 123n
    });
  });
});

describe("stackSlots", () => {
  it("rounds stack usage up", () => {
    expect(stackSlots(0n, 200n)).toBe(0);
    expect(stackSlots(1n, 200n)).toBe(1);
    expect(stackSlots(200n, 200n)).toBe(1);
    expect(stackSlots(201n, 200n)).toBe(2);
  });
});
