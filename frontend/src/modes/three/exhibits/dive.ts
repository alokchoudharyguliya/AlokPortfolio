/**
 * Dive maths — pure functions (no three.js, no DOM) that turn page scroll into
 * a depth inside an exhibit, and depth into camera poses and fade amounts.
 *
 * Terms:
 *   station    a stop on the camera's flight; exhibits are stations too
 *   hold       extra scroll distance over which the camera stays on one station
 *              (a pinned exhibit holds for its whole sticky travel)
 *   depth `d`  0 … levels−1; level k is centred on d = k
 *
 *   scrollY ──► fractionalStationHeld()  which station (f stays put during a hold)
 *   scrollY ──► diveDepth()              how deep inside that exhibit
 *   d ──► trapezoid() / levelWindow()    how visible each level's geometry is
 *   d ──► interpolatePose()              camera between two level poses
 */
import type { Pose, Vec3 } from "../scene/stations";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Where each station sits on the page's scroll axis, and how long the camera
 * holds there.
 *
 * Ordinary stations are anchored where they are centred in the viewport, with
 * no hold. A pinned exhibit (`levels > 0`) is anchored where its top meets the
 * viewport top and holds for the sticky travel (its height minus one
 * viewport). Anchors are forced strictly increasing, and each begins after the
 * previous hold ends, so interpolation never runs backwards.
 */
export function stationLayout(
  rects: { top: number; height: number }[],
  levels: number[],
  scrollY: number,
  viewportH: number,
): { anchors: number[]; holds: number[] } {
  const anchors: number[] = [];
  const holds: number[] = [];
  rects.forEach((r, i) => {
    const pinned = (levels[i] ?? 0) > 0;
    const natural = pinned ? r.top + scrollY : r.top + scrollY + r.height / 2 - viewportH / 2;
    const hold = pinned ? Math.max(0, r.height - viewportH) : 0;
    const j = anchors.length - 1;
    const floor = j < 0 ? -Infinity : anchors[j] + holds[j] + 1;
    anchors.push(Math.max(natural, floor));
    holds.push(hold);
  });
  return { anchors, holds };
}

/**
 * Fractional station index for a scroll offset. Like `fractionalStation`, but
 * the camera stays exactly on station i from `anchors[i]` until
 * `anchors[i] + holds[i]`, and only then starts flying to station i+1.
 */
export function fractionalStationHeld(scrollY: number, anchors: number[], holds: number[]): number {
  const n = anchors.length;
  if (n < 2) return 0;
  if (scrollY <= anchors[0]) return 0;
  if (scrollY >= anchors[n - 1]) return n - 1;
  let i = 0;
  while (i < n - 2 && scrollY >= anchors[i + 1]) i++;
  const start = anchors[i] + (holds[i] ?? 0);
  const end = anchors[i + 1];
  if (scrollY <= start || end <= start) return i;
  return i + (scrollY - start) / (end - start);
}

/** Depth inside a pinned exhibit for a scroll offset: 0 before it starts, `levels − 1` once it ends. */
export function diveDepth(scrollY: number, anchor: number, hold: number, levels: number): number {
  if (levels <= 1 || hold <= 0) return 0;
  return clamp((scrollY - anchor) / hold, 0, 1) * (levels - 1);
}

/** The level nearest to depth `d` (for captions and the breadcrumb). */
export function levelAt(d: number, levels: number): number {
  return clamp(Math.round(d), 0, Math.max(0, levels - 1));
}

/**
 * 0 → 1 → 0 window: rises between `a` and `b`, holds until `c`, falls to zero at `d`.
 * Edges are smoothstepped so geometry fades without a visible kink.
 */
export function trapezoid(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x < b) return smooth((x - a) / (b - a));
  if (x <= c) return 1;
  return smooth((d - x) / (d - c));
}

export type FadeWindow = [number, number, number, number];

/**
 * Visibility window for the geometry that belongs to `level`. Neighbouring
 * levels overlap so one dissolves into the next; the first level is fully
 * visible before the dive begins and the last stays visible to the end.
 */
export function levelWindow(level: number, levels: number): FadeWindow {
  const first = level <= 0;
  const last = level >= levels - 1;
  return [first ? -9 : level - 1, first ? -9 : level - 0.4, last ? 99 : level + 0.4, last ? 99 : level + 1];
}

/** Blend two camera poses. */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const mix = (p: Vec3, q: Vec3): Vec3 => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];
  return { pos: mix(a.pos, b.pos), look: mix(a.look, b.look) };
}

/**
 * Camera pose between two level poses. The look-at point and the direction
 * blend linearly, but the camera's *distance* from it blends geometrically, so
 * a 30× zoom feels like steady, even speed rather than racing at the end.
 */
export function interpolatePose(a: Pose, b: Pose, t: number): Pose {
  const offA = sub(a.pos, a.look);
  const offB = sub(b.pos, b.look);
  const lenA = Math.hypot(...offA) || 1e-6;
  const lenB = Math.hypot(...offB) || 1e-6;
  const dir: Vec3 = [
    lerp(offA[0] / lenA, offB[0] / lenB, t),
    lerp(offA[1] / lenA, offB[1] / lenB, t),
    lerp(offA[2] / lenA, offB[2] / lenB, t),
  ];
  const dirLen = Math.hypot(...dir) || 1;
  const dist = Math.exp(lerp(Math.log(lenA), Math.log(lenB), t));
  const look: Vec3 = [lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t)];
  return {
    look,
    pos: [look[0] + (dir[0] / dirLen) * dist, look[1] + (dir[1] / dirLen) * dist, look[2] + (dir[2] / dirLen) * dist],
  };
}

/** Camera pose at depth `d` along per-level poses (eased between neighbours). */
export function poseAtDepth(levelPoses: Pose[], d: number): Pose {
  const n = levelPoses.length;
  if (n === 0) throw new Error("poseAtDepth needs at least one level pose");
  if (n === 1) return levelPoses[0];
  const x = clamp(d, 0, n - 1);
  const i = Math.min(Math.floor(x), n - 2);
  return interpolatePose(levelPoses[i], levelPoses[i + 1], smooth(x - i));
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
