import { describe, expect, it } from "vitest";
import { PlantBody, QuickSellBody } from "./prototype-0.1.js";

describe("prototype 0.1 contracts", () => {
  it("rejects invalid crop identifiers and unexpected fields", () => {
    const result = PlantBody.safeParse({
      cropDefinitionId: "not-a-uuid",
      coins: 999999
    });
    expect(result.success).toBe(false);
  });

  it("requires positive quick-sell quantity", () => {
    const result = QuickSellBody.safeParse({
      inventoryItemId: "00000000-0000-4000-8000-000000000001",
      quantity: 0
    });
    expect(result.success).toBe(false);
  });
});
