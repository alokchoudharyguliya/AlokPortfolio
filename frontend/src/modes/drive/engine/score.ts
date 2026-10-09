/**
 * Points for the optional leaderboard. Deliberately "more is better" (the backend
 * ranks higher scores first), so it is points, not lap time:
 *   +0.1 per metre driven, +50 per boost pad, +10 per car overtaken, −30 per crash.
 */
export interface DriveStats {
  distance: number;
  boosts: number;
  crashes: number;
  passes: number;
  /** Seconds spent driving (not parked at a gate). */
  elapsed: number;
}

export const EMPTY_STATS: DriveStats = { distance: 0, boosts: 0, crashes: 0, passes: 0, elapsed: 0 };

export function scoreOf(stats: DriveStats): number {
  return Math.max(0, Math.round(stats.distance * 0.1 + stats.boosts * 50 + stats.passes * 10 - stats.crashes * 30));
}

/** "2:05" style clock for the HUD. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
