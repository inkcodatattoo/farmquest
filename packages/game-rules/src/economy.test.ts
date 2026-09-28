import { describe, expect, it } from "vitest";
import { quickSellPayout } from "./economy.js";

describe("quickSellPayout", () => {
  it("applies quality and 2% fee using integers", () => {
    expect(
      quickSellPayout({
        quantity: 10n,
        unitPrice: 10n,
        sellMultiplierBps: 12_500n,
        feeBps: 200n
      })
    ).toEqual({
      grossAdjusted: 125n,
      fee: 2n,
      payout: 123n
    });
  });
});
