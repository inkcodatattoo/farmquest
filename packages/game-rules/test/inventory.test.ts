import { describe, expect, it } from "vitest";
import {
  canFitInventory,
  inventorySlotsUsed
} from "../src/inventory.js";

describe("inventory slots", () => {
  it("uses ceil(quantity / stackLimit)", () => {
    expect(
      inventorySlotsUsed(
        [
          { key: "corn:common", quantity: 1n },
          { key: "corn:good", quantity: 201n }
        ],
        200
      )
    ).toBe(3);
  });

  it("reuses an existing stack before consuming a new slot", () => {
    expect(
      canFitInventory({
        stacks: [{ key: "corn:common", quantity: 199n }],
        additions: [{ key: "corn:common", quantity: 1n }],
        stackLimit: 200,
        inventorySlots: 1
      })
    ).toBe(true);
  });

  it("rejects an addition that would exceed the slot limit", () => {
    expect(
      canFitInventory({
        stacks: [{ key: "corn:common", quantity: 200n }],
        additions: [{ key: "seed:none", quantity: 1n }],
        stackLimit: 200,
        inventorySlots: 1
      })
    ).toBe(false);
  });
});
