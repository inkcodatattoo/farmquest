import { describe, expect, it } from "vitest";
import { calculateQuickSell } from "../src/economy.js";

describe("calculateQuickSell", () => {
  it("applies quality and the closed 2% fee using integer arithmetic", () => {
    expect(
      calculateQuickSell({
        quantity: 10n,
        unitPrice: 10n,
        sellMultiplierBps: 12_500n,
        feeBps: 200n
      })
    ).toEqual({
      grossValue: 125n,
      feeValue: 3n,
      payout: 122n
    });
  });

  it("floors only through integer division", () => {
    expect(
      calculateQuickSell({
        quantity: 1n,
        unitPrice: 10n,
        sellMultiplierBps: 12_500n,
        feeBps: 200n
      })
    ).toEqual({
      grossValue: 12n,
      feeValue: 0n,
      payout: 12n
    });
  });
});
