export type PlotTemporalState = "PLANTED" | "READY" | "ROTTEN";

export function getPlotTemporalState(
  now: Date,
  growsAt: Date,
  rotsAt: Date
): PlotTemporalState {
  const time = now.getTime();

  if (time >= rotsAt.getTime()) return "ROTTEN";
  if (time >= growsAt.getTime()) return "READY";
  return "PLANTED";
}

export function addSeconds(instant: Date, seconds: number): Date {
  if (!Number.isInteger(seconds) || seconds < 0) {
    throw new Error("SECONDS_MUST_BE_NON_NEGATIVE_INTEGER");
  }

  return new Date(instant.getTime() + seconds * 1000);
}
