import { describe, expect, it } from "vitest";
import { prototype01Fixtures } from "../src/fixtures/prototype-0.1.js";

describe("Prototype 0.1 provisional fixture manifest", () => {
  it("preserves closed initial farm values", () => {
    expect(prototype01Fixtures.farm.initialCoins).toBe(100n);
    expect(prototype01Fixtures.farm.initialPlots).toBe(3);
    expect(prototype01Fixtures.farm.initialSeeds).toBe(3);
    expect(prototype01Fixtures.quickSell.feeBps).toBe(200);
    expect(prototype01Fixtures.crop.rotAfterSeconds).toBe(86_400);
  });

  it("marks balance assumptions as pending instead of silently closing them", () => {
    expect(prototype01Fixtures.crop.starterSeed.pending).toBe("PD-23");
    expect(prototype01Fixtures.shop.source.pending).toBe("PD-06");
    expect(prototype01Fixtures.harvest.siteRoutes.pending).toBe("PD-07");
    expect(prototype01Fixtures.harvest.inventoryFull.pending).toBe("PD-08");
    expect(prototype01Fixtures.harvest.qualityRoll.pending).toBe("PD-09");
    expect(prototype01Fixtures.saleXp.source.pending).toBe("PD-19");
  });

  it("keeps provisional quality weights as integer weights totaling 10000", () => {
    const total = Object.values(prototype01Fixtures.qualities)
      .reduce((sum, quality) => sum + quality.weight, 0);

    expect(total).toBe(10_000);
  });
});
