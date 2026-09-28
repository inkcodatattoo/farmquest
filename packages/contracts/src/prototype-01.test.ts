import { describe, expect, it } from "vitest";
import { PlantRequest, QuickSellRequest } from "./prototype-01.js";

describe("prototype 0.1 contracts", () => {
  it("rejects invalid crop identifiers and unexpected fields", () => {
    const result = PlantRequest.safeParse({
      cropDefinitionId: "not-a-uuid",
      coins: 999999
    });
    expect(result.success).toBe(false);
  });

  it("requires positive quick-sell quantity", () => {
    const result = QuickSellRequest.safeParse({
      inventoryItemId: "00000000-0000-4000-8000-000000000001",
      quantity: 0
    });
    expect(result.success).toBe(false);
  });
});
