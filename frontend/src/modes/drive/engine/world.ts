/**
 * Things on the road: slow traffic and boost pads. Generated deterministically
 * from the route's seed, kept away from the gates, and only advanced while the
 * car is actually driving (so nothing rams a car that is parked at a gate).
 */
import { LANES } from "./route";
import type { Route } from "./route";
import { mulberry32 } from "./rng";
import type { VehicleState } from "./vehicle";

export interface TrafficCar {
  id: number;
  s: number;
  x: number;
  speed: number;
  /** Index into the renderer's list of car models. */
  model: number;
  passed: boolean;
}

export interface BoostPad {
  id: number;
  s: number;
  x: number;
  taken: boolean;
}

export interface World {
  traffic: TrafficCar[];
  pads: BoostPad[];
}

/** Keep-out zone around every gate: nothing is placed from 200 m before to 60 m after. */
export function nearGate(route: Route, s: number, before = 200, after = 60): boolean {
  return route.checkpoints.some((c) => s > c.s - before && s < c.s + after);
}

export function buildWorld(route: Route, options: { modelCount: number; traffic: boolean }): World {
  const rand = mulberry32(route.seed ^ 0x9e3779b9);
  const traffic: TrafficCar[] = [];
  const pads: BoostPad[] = [];

  if (options.traffic) {
    let id = 0;
    for (let s = 140; s < route.length - 100; s += 100 + 70 * rand()) {
      if (nearGate(route, s)) continue;
      traffic.push({
        id: id++,
        s,
        x: LANES[Math.floor(rand() * LANES.length)],
        speed: 14 + 8 * rand(),
        model: Math.floor(rand() * Math.max(1, options.modelCount)),
        passed: false,
      });
    }
  }

  let id = 0;
  for (let s = 220; s < route.length - 80; s += 180 + 120 * rand()) {
    if (nearGate(route, s, 120, 60)) continue;
    pads.push({ id: id++, s, x: LANES[Math.floor(rand() * LANES.length)], taken: false });
  }

  return { traffic, pads };
}

export function stepTraffic(world: World, dt: number) {
  for (const car of world.traffic) car.s += car.speed * dt;
}

const HIT_S = 3.4;
const HIT_X = 2.2;

export function hitsCar(v: VehicleState, car: TrafficCar): boolean {
  return Math.abs(car.s - v.s) < HIT_S && Math.abs(car.x - v.x) < HIT_X;
}

export function touchesPad(v: VehicleState, pad: BoostPad): boolean {
  return !pad.taken && Math.abs(pad.s - v.s) < 3 && Math.abs(pad.x - v.x) < 2.4;
}

/** Move traffic out of the car's way when it (re)starts, so a frozen car can't be sitting inside it. */
export function clearAround(world: World, s: number) {
  for (const car of world.traffic) {
    if (car.s > s - 10 && car.s < s + 30) car.s = s + 70 + (car.id % 5) * 12;
  }
}

/** Nearest traffic ahead of `s` within `range` metres, in lanes near `x` (for the autopilot). */
export function carAhead(world: World, s: number, x: number, range: number, halfWidth = 2.6): TrafficCar | null {
  let best: TrafficCar | null = null;
  for (const car of world.traffic) {
    const d = car.s - s;
    if (d > 0 && d < range && Math.abs(car.x - x) < halfWidth && (!best || d < best.s - s)) best = car;
  }
  return best;
}
