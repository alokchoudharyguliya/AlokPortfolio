/**
 * The road. Pure functions only (no three.js, no DOM), so the whole route is
 * unit-tested.
 *
 * The portfolio's sections define the route: one checkpoint per section, in the
 * owner's order. If the owner reorders or hides sections in sudo, the road is
 * rebuilt from whatever sections are rendered.
 *
 * Conventions (shared by vehicle.ts and the renderer):
 *   s          distance along the road in metres, 0 at the start line
 *   x          lateral position in metres from the centre line, + = right
 *   heading θ  0 faces −z; + turns right (clockwise from above)
 *   curvature κ  dθ/ds, + = turning right. A right turn pushes the car LEFT (−x)
 *   world      x right, y up, z backward; forward direction = (sin θ, 0, −cos θ)
 *
 * Shape of a gap between two checkpoints:
 *   [ 60 m straight | turn pair (+Δ then −Δ, or the mirror) | straight ... | 150 m straight → gate ]
 * Turns are built in opposite-sign pairs, so the road always returns to its
 * original heading and never loops back on itself. Gates sit on flat straights.
 */
import { clamp, hashString, mulberry32, smoothstep } from "./rng";

export const STEP = 4; // metres between centre-line samples
export const ROAD_HALF = 6; // road is 12 m wide (three 4 m lanes)
export const LANES = [-4, 0, 4] as const;
export const GAP = 600; // metres between checkpoints (~22 s of driving at cruise speed)
export const GATE_APPROACH = 150; // straight run-up before a gate
export const GATE_EXIT = 60; // straight after a gate
const PAD_BEFORE = 80; // road rendered behind the start line
const PAD_AFTER = 420; // road rendered past the finish

export interface Checkpoint {
  key: string;
  index: number;
  /** Distance along the road at which the car stops (the gate line). */
  s: number;
}

export interface Feature {
  /** Distance where the turn starts, and its length in metres. */
  start: number;
  length: number;
  /** Total heading change in radians (+ right). */
  angle: number;
}

export interface Route {
  keys: string[];
  checkpoints: Checkpoint[];
  /** Distance of the finish line (the last checkpoint). */
  length: number;
  features: Feature[];
  seed: number;
  /** First and last sampled distance, and per-sample arrays (index i ↔ s = from + i * STEP). */
  from: number;
  to: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  heading: Float32Array;
  curvature: Float32Array;
}

export interface RoadSample {
  x: number;
  y: number;
  z: number;
  heading: number;
  curvature: number;
  /** dy/ds (rise over run) */
  slope: number;
}

/** Curvature at distance s from the turn features: a smooth bump whose integral is exactly the feature's angle. */
export function featureCurvature(features: Feature[], s: number): number {
  let k = 0;
  for (const f of features) {
    if (s <= f.start || s >= f.start + f.length) continue;
    const t = (s - f.start) / f.length;
    k += (f.angle / f.length) * (1 - Math.cos(2 * Math.PI * t));
  }
  return k;
}

/** Elevation: gentle hills that flatten near every gate so gates and panels sit level. */
function elevation(s: number, checkpoints: Checkpoint[], waves: { amp: number; len: number; phase: number }[]): number {
  let nearest = Infinity;
  for (const c of checkpoints) nearest = Math.min(nearest, Math.abs(s - c.s));
  const flat = smoothstep(30, 130, nearest);
  let y = 0;
  for (const w of waves) y += w.amp * Math.sin((2 * Math.PI * s) / w.len + w.phase);
  return y * flat;
}

export function routeSeed(keys: string[]): number {
  return hashString(keys.join("|") || "empty");
}

/** Build the route for the given checkpoint keys (section keys, in order). */
export function buildRoute(keys: string[], options: { gap?: number } = {}): Route {
  const gap = options.gap ?? GAP;
  const seed = routeSeed(keys);
  const rand = mulberry32(seed);

  const checkpoints: Checkpoint[] = keys.map((key, index) => ({ key, index, s: index * gap }));
  const length = checkpoints.length ? checkpoints[checkpoints.length - 1].s : 0;

  // One pair of opposite turns per gap, positioned inside the free window between the two straights.
  const features: Feature[] = [];
  for (let i = 0; i < checkpoints.length - 1; i++) {
    const a = checkpoints[i].s + GATE_EXIT;
    const b = checkpoints[i + 1].s - GATE_APPROACH;
    const window = b - a;
    const minStraight = 30;
    const maxLen = (window - minStraight) / 2;
    if (maxLen < 70) continue;

    let angle = 0.35 + 0.6 * rand(); // 20°–54°
    let len = clamp(300 * angle * (0.95 + 0.3 * rand()), 70, maxLen);
    // Tightest radius at the bump's peak is len / (2 * angle); keep it at or above 110 m.
    angle = Math.min(angle, len / 220);
    len = Math.max(len, 70);
    const sign = rand() > 0.5 ? 1 : -1;
    const straight = clamp(window - 2 * len, minStraight, window);
    const offset = (window - 2 * len - straight) * rand();
    const first = a + offset;
    features.push({ start: first, length: len, angle: sign * angle });
    features.push({ start: first + len + straight, length: len, angle: -sign * angle });
  }

  const waves = [
    { amp: 3 + 3 * rand(), len: 260 + 160 * rand(), phase: rand() * Math.PI * 2 },
    { amp: 1 + 2 * rand(), len: 120 + 80 * rand(), phase: rand() * Math.PI * 2 },
  ];

  const from = -PAD_BEFORE;
  const to = length + PAD_AFTER;
  const n = Math.floor((to - from) / STEP) + 1;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const z = new Float32Array(n);
  const heading = new Float32Array(n);
  const curvature = new Float32Array(n);

  // Integrate the centre line. Start at the origin heading straight ahead.
  let theta = 0;
  let px = 0;
  let pz = 0;
  for (let i = 0; i < n; i++) {
    const s = from + i * STEP;
    const k = featureCurvature(features, s);
    curvature[i] = k;
    heading[i] = theta;
    x[i] = px;
    z[i] = pz;
    y[i] = elevation(s, checkpoints, waves);
    // Mid-point integration keeps the heading error tiny at a 4 m step.
    const kNext = featureCurvature(features, s + STEP / 2);
    const thetaMid = theta + (kNext * STEP) / 2;
    px += Math.sin(thetaMid) * STEP;
    pz -= Math.cos(thetaMid) * STEP;
    theta += kNext * STEP;
  }

  return { keys, checkpoints, length, features, seed, from, to, x, y, z, heading, curvature };
}

/** Linear interpolation of the sampled centre line at distance s (clamped to the built range). */
export function sampleRoute(route: Route, s: number): RoadSample {
  const f = clamp((s - route.from) / STEP, 0, route.x.length - 1.0001);
  const i = Math.floor(f);
  const t = f - i;
  const mix = (arr: Float32Array) => arr[i] + (arr[i + 1] - arr[i]) * t;
  return {
    x: mix(route.x),
    y: mix(route.y),
    z: mix(route.z),
    heading: mix(route.heading),
    curvature: mix(route.curvature),
    slope: (route.y[i + 1] - route.y[i]) / STEP,
  };
}

/** World position of a point at distance s and lateral offset `lateral` metres (+ right). */
export function roadPoint(route: Route, s: number, lateral = 0): { x: number; y: number; z: number; heading: number } {
  const p = sampleRoute(route, s);
  return {
    x: p.x + Math.cos(p.heading) * lateral,
    y: p.y,
    z: p.z + Math.sin(p.heading) * lateral,
    heading: p.heading,
  };
}

/** The checkpoint nearest to distance s. */
export function nearestCheckpoint(route: Route, s: number): Checkpoint | null {
  let best: Checkpoint | null = null;
  for (const c of route.checkpoints) if (!best || Math.abs(c.s - s) < Math.abs(best.s - s)) best = c;
  return best;
}
