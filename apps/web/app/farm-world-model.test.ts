import { describe, expect, it } from "vitest";
import {
  MAX_FARM_PLOTS,
  buildFarmPlotSlots,
  resolvePlotState,
  type FarmWorldPlot
} from "./farm-world-model";

const NOW = Date.parse("2026-09-30T12:00:00.000Z");

function emptyPlot(
  slotNumber: number,
  overrides: Partial<FarmWorldPlot> = {}
): FarmWorldPlot {
  return {
    id: `plot-${slotNumber}`,
    slotNumber,
    unlocked: true,
    seedsCapacity: 1,
    state: "EMPTY",
    planted: null,
    ...overrides
  };
}

function plantedPlot(
  overrides: Partial<FarmWorldPlot["planted"] & {}> = {}
): FarmWorldPlot {
  return {
    ...emptyPlot(1),
    state: "PLANTED",
    planted: {
      cropDefinitionId: "crop-corn",
      cropName: "Milho",
      seedCount: 1,
      plantedAt: "2026-09-30T11:55:00.000Z",
      growsAt: "2026-09-30T12:05:00.000Z",
      rotsAt: "2026-09-30T13:05:00.000Z",
      ...overrides
    }
  };
}

describe("buildFarmPlotSlots", () => {
  it("creates exactly the 15 supported visual slots by default", () => {
    const slots = buildFarmPlotSlots([], NOW);

    expect(slots).toHaveLength(MAX_FARM_PLOTS);
    expect(slots.map((slot) => slot.slotNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
    ]);
  });

  it("looks plots up by slotNumber even when the input is out of order", () => {
    const slots = buildFarmPlotSlots([
      emptyPlot(3, { id: "third" }),
      emptyPlot(1, { id: "first" }),
      emptyPlot(2, { id: "second" })
    ], NOW);

    expect(slots[0]?.plot?.id).toBe("first");
    expect(slots[1]?.plot?.id).toBe("second");
    expect(slots[2]?.plot?.id).toBe("third");
  });

  it("marks both absent and explicitly locked plots as LOCKED", () => {
    const slots = buildFarmPlotSlots([
      emptyPlot(2, { unlocked: false })
    ], NOW);

    expect(slots[0]).toMatchObject({ plot: null, state: "LOCKED" });
    expect(slots[1]).toMatchObject({
      plot: { id: "plot-2", unlocked: false },
      state: "LOCKED"
    });
  });

  it("maps an unlocked empty API plot to AVAILABLE", () => {
    const [slot] = buildFarmPlotSlots([emptyPlot(1)], NOW);

    expect(slot?.state).toBe("AVAILABLE");
  });

  it("never creates slots above the farm visual limit", () => {
    const slots = buildFarmPlotSlots(
      [emptyPlot(15), emptyPlot(16)],
      NOW,
      MAX_FARM_PLOTS + 10
    );

    expect(slots).toHaveLength(MAX_FARM_PLOTS);
    expect(slots.at(-1)?.slotNumber).toBe(15);
    expect(slots.some((slot) => slot.plot?.slotNumber === 16)).toBe(false);
  });
});

describe("resolvePlotState", () => {
  it("derives PLANTED before growsAt", () => {
    expect(resolvePlotState(plantedPlot(), NOW)).toBe("PLANTED");
  });

  it("derives READY exactly at growsAt", () => {
    const plot = plantedPlot({ growsAt: new Date(NOW).toISOString() });

    expect(resolvePlotState(plot, NOW)).toBe("READY");
  });

  it("derives ROTTEN exactly at rotsAt, before considering READY", () => {
    const plot = plantedPlot({
      growsAt: new Date(NOW - 60_000).toISOString(),
      rotsAt: new Date(NOW).toISOString()
    });

    expect(resolvePlotState(plot, NOW)).toBe("ROTTEN");
  });
});
