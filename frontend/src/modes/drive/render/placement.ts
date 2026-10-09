/**
 * Where scenery goes. Pure functions over the route (no three.js), so the
 * layout is deterministic and unit-tested; the renderer only turns these
 * placements into instance matrices.
 *
 * Terrain model (shared with the renderer's ground ribbon): around the road the
 * ground follows the road's elevation out to ±GROUND_FLAT metres, then slopes
 * down to world level (y = 0) at ±GROUND_EDGE. So hills read as embankments.
 */
import { BARRIER } from "../engine/vehicle";
import { nearGate } from "../engine/world";
import { mulberry32, smoothstep } from "../engine/rng";
import { ROAD_HALF, roadPoint, sampleRoute } from "../engine/route";
import type { Route } from "../engine/route";

export const GROUND_FLAT = 28;
export const GROUND_EDGE = 70;
export const RAIL_STEP = 4;
export const LAMP_STEP = 48;

export interface Placement {
  s: number;
  /** Lateral offset from the centre line in metres (+ right). */
  lateral: number;
  scale: number;
  /** Extra rotation about the vertical axis, radians. */
  spin: number;
  /** Which model variant (trees: 0 = large, 1 = small). */
  variant: number;
}

/** Ground height at a lateral offset, given the road elevation `roadY` there. */
export function groundHeight(roadY: number, lateral: number): number {
  return roadY * (1 - smoothstep(GROUND_FLAT, GROUND_EDGE, Math.abs(lateral)));
}

/** Trees on both sides, thinned out near gates so the gate stays in view. `density` scales the count (quality tiers). */
export function scatterTrees(route: Route, density = 1): Placement[] {
  const rand = mulberry32(route.seed ^ 0x51ed270b);
  const out: Placement[] = [];
  const step = 11 / Math.max(0.2, density);
  for (let s = route.from + 20; s < route.to; s += step * (0.6 + 0.8 * rand())) {
    for (const side of [-1, 1]) {
      if (rand() < 0.28) continue; // gaps
      const clearing = nearGate(route, s, 160, 40);
      const lateral = side * ((clearing ? 30 : 13) + 30 * rand() * rand() * 2);
      if (Math.abs(lateral) > GROUND_EDGE - 6) continue;
      out.push({ s, lateral, scale: 0.8 + 0.7 * rand(), spin: rand() * Math.PI * 2, variant: rand() < 0.35 ? 1 : 0 });
    }
  }
  return out;
}

/** Guard-rail segments along both road edges, every RAIL_STEP metres, over the whole route. */
export function railPlacements(route: Route): Placement[] {
  const out: Placement[] = [];
  for (let s = route.from; s < route.to; s += RAIL_STEP) {
    for (const side of [-1, 1]) out.push({ s, lateral: side * BARRIER, scale: 1, spin: 0, variant: 0 });
  }
  return out;
}

/** Lamp posts on the right-hand verge. */
export function lampPlacements(route: Route): Placement[] {
  const out: Placement[] = [];
  for (let s = route.from + 10; s < route.to; s += LAMP_STEP) {
    out.push({ s, lateral: BARRIER + 1.4, scale: 1, spin: 0, variant: 0 });
  }
  return out;
}

/** Distant hills ringing the route, big and far so fog turns them into haze. */
export function mountainPlacements(route: Route, count = 140): Placement[] {
  const rand = mulberry32(route.seed ^ 0x2545f491);
  const out: Placement[] = [];
  for (let i = 0; i < count; i++) {
    const s = route.from + rand() * (route.to - route.from);
    const side = rand() > 0.5 ? 1 : -1;
    out.push({ s, lateral: side * (330 + 300 * rand()), scale: 0.5 + 0.8 * rand(), spin: rand() * Math.PI * 2, variant: 0 });
  }
  return out;
}

export interface WorldTransform {
  x: number;
  y: number;
  z: number;
  /** Rotation about the vertical axis (three.js convention: counter-clockwise from above). */
  rotY: number;
}

/** World-space position and facing of a placement, sitting on the terrain. */
export function placementTransform(route: Route, p: Placement): WorldTransform {
  const sample = sampleRoute(route, p.s);
  const pt = roadPoint(route, p.s, p.lateral);
  return { x: pt.x, y: groundHeight(sample.y, p.lateral), z: pt.z, rotY: -sample.heading + p.spin };
}

/** Whether a lateral offset is clear of the tarmac (used by tests and by scenery rules). */
export const offTarmac = (lateral: number) => Math.abs(lateral) > ROAD_HALF;
