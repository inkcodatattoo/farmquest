import { describe, expect, it } from "vitest";
import { addSeconds, getPlotTemporalState } from "../src/time.js";

describe("getPlotTemporalState", () => {
  const growsAt = new Date("2026-09-28T20:01:00.000Z");
  const rotsAt = new Date("2026-09-29T20:01:00.000Z");

  it("is PLANTED before growsAt", () => {
    expect(getPlotTemporalState(new Date("2026-09-28T20:00:59.999Z"), growsAt, rotsAt))
      .toBe("PLANTED");
  });

  it("is READY exactly at growsAt", () => {
    expect(getPlotTemporalState(growsAt, growsAt, rotsAt)).toBe("READY");
  });

  it("is ROTTEN exactly at rotsAt", () => {
    expect(getPlotTemporalState(rotsAt, growsAt, rotsAt)).toBe("ROTTEN");
  });
});

describe("addSeconds", () => {
  it("adds integer seconds without mutating the source date", () => {
    const start = new Date("2026-09-28T20:00:00.000Z");
    const result = addSeconds(start, 60);

    expect(result.toISOString()).toBe("2026-09-28T20:01:00.000Z");
    expect(start.toISOString()).toBe("2026-09-28T20:00:00.000Z");
  });

  it("rejects negative values", () => {
    expect(() => addSeconds(new Date(), -1)).toThrow(
      "SECONDS_MUST_BE_NON_NEGATIVE_INTEGER"
    );
  });
});
