/**
 * Autopilot: keeps the lane, steers through bends and goes around traffic.
 * It produces the same `Controls` a person would, so it is subject to exactly
 * the same physics (and can be tested against it). Used by the Autopilot
 * button and by tests that drive a whole route.
 */
import { clamp } from "./rng";
import { LANES } from "./route";
import type { Controls, VehicleState } from "./vehicle";
import { carAhead } from "./world";
import type { World } from "./world";

const STEER_ACCEL = 36; // keep in sync with vehicle.ts
const CURVE_PUSH = 2.5;

export function autopilot(state: VehicleState, curvature: number, world: World | null): Controls {
  // Pick a lane: the centre one unless traffic is in the way, then the nearest free lane.
  let targetX = 0;
  let brake = 0;
  if (world) {
    const blocked = (lane: number) => carAhead(world, state.s - 6, lane, 75, 2.4) !== null;
    if (blocked(0) || carAhead(world, state.s, state.x, 55, 2.6)) {
      const free = LANES.filter((l) => !blocked(l)).sort((a, b) => Math.abs(a - state.x) - Math.abs(b - state.x));
      if (free.length) targetX = free[0];
      else {
        // Boxed in: slow down behind the nearest car.
        const ahead = carAhead(world, state.s, state.x, 40, 2.6);
        if (ahead && state.speed > ahead.speed + 1) brake = 0.6;
      }
    }
  }

  const grip = clamp(state.speed / 10, 0.3, 1);
  const feedForward = (curvature * state.speed * state.speed * CURVE_PUSH) / (STEER_ACCEL * grip);
  const desiredVx = clamp((targetX - state.x) * 1.4, -6, 6);
  const steer = clamp(feedForward + (desiredVx - state.vx) * 0.35, -1, 1);
  return { steer, throttle: 0, brake };
}
