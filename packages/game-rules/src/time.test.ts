import { describe, expect, it } from "vitest";
import { getPlotTemporalState } from "./time.js";

describe("getPlotTemporalState", () => {
  const growsAt = new Date("2026-09-28T12:01:00.000Z");
  const rotsAt = new Date("2026-09-29T12:01:00.000Z");

  it("derives PLANTED, READY and ROTTEN from timestamps", () => {
    expect(getPlotTemporalState(new Date("2026-09-28T12:00:59.000Z"), growsAt, rotsAt)).toBe("PLANTED");
    expect(getPlotTemporalState(new Date("2026-09-28T12:01:00.000Z"), growsAt, rotsAt)).toBe("READY");
    expect(getPlotTemporalState(new Date("2026-09-29T12:01:00.000Z"), growsAt, rotsAt)).toBe("ROTTEN");
  });
});
