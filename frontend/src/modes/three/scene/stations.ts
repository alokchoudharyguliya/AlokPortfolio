/**
 * Camera "stations": where the camera sits for each section, and the maths
 * that turns scroll position into a smooth flight between them. Pure
 * functions only (no three.js, no DOM) so the whole path is unit-tested.
 *
 * The page's sections define the route. If the owner reorders or hides
 * sections, the flight path is rebuilt from whatever sections are rendered:
 *
 *   section tops ──► anchors (scroll offset at which each section is centred)
 *   scrollY ──► fractionalStation(): 1.4 = 40% of the way from station 1 to 2
 *   fractional index ──► samplePath(): Catmull–Rom through the station poses
 */

import { exhibitForKey } from "../exhibits/catalog";

export type Vec3 = [number, number, number];

export interface Pose {
  pos: Vec3;
  look: Vec3;
}

/**
 * The world is a GPU die at the origin (24 × 24 units, y up) ringed by memory
 * stacks, with data streaming in from every side. Each pose frames the part
 * of the scene that illustrates its section.
 */
export const POSES: Record<string, Pose> = {
  hero: { pos: [0, 10, 40], look: [0, 2, 0] },
  about: { pos: [-15, 8, 26], look: [0, 1, 0] },
  focus: { pos: [16, 7, 22], look: [0, 1, 0] },
  experience: { pos: [0, 6, 27], look: [0, 4.2, 0] },
  projects: { pos: [0, 19, 15], look: [0, 0, 1] },
  skills: { pos: [-6, 11, 32], look: [0, 8, 0] },
  education: { pos: [20, 5, 12], look: [0, 1, -2] },
  achievements: { pos: [-20, 6, 10], look: [0, 1, -2] },
  blog: { pos: [0, 4, 24], look: [0, 1, -6] },
  arcade: { pos: [0, 9, 18], look: [0, 0, 0] },
  contact: { pos: [0, 28, 44], look: [0, 0, 0] },
  /** Detail pages (project, post, 404): a calm wide shot behind the article. */
  ambient: { pos: [0, 14, 40], look: [0, 1, 0] },
};

/** Exhibit stations (`exhibit:<id>`) rest on their catalogue's wide shot until the dive starts. */
export const poseFor = (key: string): Pose => POSES[key] ?? exhibitForKey(key)?.wide ?? POSES.ambient;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Scroll offsets at which each station is centred in the viewport, forced to
 * be strictly increasing so interpolation never divides by zero or runs backwards.
 */
export function anchorsFromRects(rects: { top: number; height: number }[], scrollY: number, viewportH: number): number[] {
  const anchors: number[] = [];
  for (const r of rects) {
    const centred = r.top + scrollY + r.height / 2 - viewportH / 2;
    const prev = anchors[anchors.length - 1];
    anchors.push(prev === undefined ? centred : Math.max(centred, prev + 1));
  }
  return anchors;
}

/** Fractional station index for a scroll offset (clamped to the first/last station). */
export function fractionalStation(scrollY: number, anchors: number[]): number {
  const n = anchors.length;
  if (n < 2) return 0;
  if (scrollY <= anchors[0]) return 0;
  if (scrollY >= anchors[n - 1]) return n - 1;
  let i = 0;
  while (i < n - 2 && scrollY >= anchors[i + 1]) i++;
  return i + (scrollY - anchors[i]) / (anchors[i + 1] - anchors[i]);
}

/** Uniform Catmull–Rom spline segment between p1 and p2. */
export function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const out: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] =
      0.5 *
      (2 * p1[k] +
        (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  }
  return out;
}

/** Camera pose at fractional station `f`, flying smoothly through every station pose. */
export function samplePath(poses: Pose[], f: number): Pose {
  const n = poses.length;
  if (n === 0) return POSES.ambient;
  if (n === 1) return poses[0];
  const x = clamp(f, 0, n - 1);
  const i = Math.min(Math.floor(x), n - 2);
  const t = x - i;
  const at = (j: number) => poses[clamp(j, 0, n - 1)];
  const spline = (pick: (p: Pose) => Vec3) => catmullRom(pick(at(i - 1)), pick(at(i)), pick(at(i + 1)), pick(at(i + 2)), t);
  return { pos: spline((p) => p.pos), look: spline((p) => p.look) };
}

/**
 * How strongly each section's visual is "on" (0–1): 1 while the camera is at
 * its station, easing to 0 one station away. The scene uses this to light up
 * the tiles, rings or pipeline that belong to the current section.
 */
export function stationWeights(keys: string[], f: number): Record<string, number> {
  const out: Record<string, number> = {};
  keys.forEach((key, i) => {
    const w = clamp(1 - Math.abs(f - i), 0, 1);
    out[key] = Math.max(out[key] ?? 0, w * w * (3 - 2 * w));
  });
  return out;
}

/**
 * Deterministic, well-spread choice of `count` distinct tiles on a
 * grid × grid die for the owner's projects (so project i always lights the
 * same tile, and tiles never cluster in one corner). Golden-ratio sequence.
 */
export function pickTiles(count: number, grid: number): number[] {
  const total = grid * grid;
  const wanted = Math.min(Math.max(0, Math.floor(count)), total);
  const used = new Set<number>();
  const out: number[] = [];
  const phi = 0.6180339887498949;
  for (let i = 0; out.length < wanted; i++) {
    let cell = Math.floor(((i + 1) * phi * 7.31 + 0.17) % 1 * total);
    // Linear-probe past collisions so the result is always `wanted` unique cells.
    while (used.has(cell)) cell = (cell + 1) % total;
    used.add(cell);
    out.push(cell);
  }
  return out;
}

/**
 * Which memory-hierarchy ring belongs to skill group `index`. The first group
 * sits on the top (hottest, "registers") ring and later groups step down toward
 * "HBM"; with more groups than rings, the extra groups share the bottom ring.
 */
export function tierRing(index: number, rings: number): number {
  return Math.max(0, rings - 1 - Math.min(Math.max(index, 0), rings - 1));
}

/** How many rings the engine builds for `groups` skill groups (kept in sync with Engine.setContent). */
export function ringCount(groups: number): number {
  return Math.min(6, Math.max(3, groups));
}
