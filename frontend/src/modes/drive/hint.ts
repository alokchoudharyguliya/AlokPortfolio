import type { GameSnapshot } from "./engine/game";

/** Show the controls hint for the first few seconds of the first leg only. */
export function hudShowsHint(snap: GameSnapshot): boolean {
  return snap.phase === "driving" && snap.index === 0 && snap.stats.elapsed < 9;
}
