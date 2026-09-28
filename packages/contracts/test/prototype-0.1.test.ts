import { describe, expect, it } from "vitest";
import {
  FarmView,
  PlantBody,
  QuickSellBody
} from "../src/prototype-0.1.js";

describe("Prototype 0.1 contracts", () => {
  it("accepts bigint values only as decimal strings", () => {
    const parsed = FarmView.parse({
      id: "11111111-1111-4111-8111-111111111111",
      level: 1,
      xp: "0",
      coins: "100",
      inventorySlots: 20,
      stackLimit: 200,
      nextHarvestAt: null,
      status: "ACTIVE"
    });

    expect(parsed.coins).toBe("100");
  });

  it("rejects arbitrary fields in plant input", () => {
    expect(() =>
      PlantBody.parse({
        cropDefinitionId: "11111111-1111-4111-8111-111111111111",
        coins: 999999
      })
    ).toThrow();
  });

  it("rejects non-positive quick-sell quantity", () => {
    expect(() =>
      QuickSellBody.parse({
        inventoryItemId: "11111111-1111-4111-8111-111111111111",
        quantity: 0
      })
    ).toThrow();
  });
});
