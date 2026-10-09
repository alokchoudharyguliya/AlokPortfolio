/**
 * Input sources → one `Controls` value. Everything here is a pure function of
 * plain data (key sets, pointer positions, gamepad / tilt readings), so each
 * device is unit-tested without a browser. The React hook (useDriveInput)
 * gathers the readings and calls these.
 *
 *   keyboard   ← → / A D steer, ↑ / W gas, ↓ / S brake
 *   touch      hold the left or right half of the screen to steer (both = straight)
 *   tilt       tilt the phone like a wheel (a neutral angle is captured when enabled)
 *   pedals     on-screen gas / brake buttons
 *   gamepad    left stick or d-pad steers, right trigger gas, left trigger brake
 */
import { clamp } from "./rng";
import type { Controls } from "./vehicle";

export const NEUTRAL: Controls = { steer: 0, throttle: 0, brake: 0 };

const LEFT = ["ArrowLeft", "a", "A"];
const RIGHT = ["ArrowRight", "d", "D"];
const UP = ["ArrowUp", "w", "W"];
const DOWN = ["ArrowDown", "s", "S"];
const any = (keys: ReadonlySet<string>, names: string[]) => names.some((n) => keys.has(n));

export function keyboardControls(keys: ReadonlySet<string>): Controls {
  return {
    steer: (any(keys, RIGHT) ? 1 : 0) - (any(keys, LEFT) ? 1 : 0),
    throttle: any(keys, UP) ? 1 : 0,
    brake: any(keys, DOWN) ? 1 : 0,
  };
}

/** Keys the game takes over (so the page doesn't scroll under the arrows). */
export const DRIVE_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

/** Touch steering from the x positions (px) of the fingers currently down. */
export function touchSteer(xs: readonly number[], width: number): number {
  if (!xs.length || width <= 0) return 0;
  const left = xs.some((x) => x < width / 2);
  const right = xs.some((x) => x >= width / 2);
  return (right ? 1 : 0) - (left ? 1 : 0);
}

/**
 * Tilt → steering. `angle` is screen.orientation.angle: in portrait the left-right
 * tilt is `gamma`; in landscape the phone is turned like a wheel, which shows up in `beta`
 * (sign flips with the landscape direction). `neutral` is the reading captured when tilt was enabled.
 */
export function tiltSteer(reading: { beta: number | null; gamma: number | null }, angle: number, neutral = 0, invert = false): number {
  const landscape = Math.abs(angle) === 90;
  const raw = landscape ? (reading.beta ?? 0) * (angle === 90 ? 1 : -1) : (reading.gamma ?? 0);
  const degrees = raw - neutral;
  const steer = clamp(degrees / 25, -1, 1);
  const dead = Math.abs(steer) < 0.08 ? 0 : steer; // small dead zone so a resting hand drives straight
  return invert ? -dead : dead;
}

export interface PadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export function gamepadControls(pad: PadLike): Controls {
  const stick = Math.abs(pad.axes[0] ?? 0) < 0.12 ? 0 : (pad.axes[0] ?? 0);
  const dpad = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
  const trigger = (i: number, fallback: number) => Math.max(pad.buttons[i]?.value ?? 0, pad.buttons[fallback]?.pressed ? 1 : 0);
  return {
    steer: clamp(stick || dpad, -1, 1),
    throttle: trigger(7, 12),
    brake: trigger(6, 13),
  };
}

/** Combine several sources: the strongest steer wins, pedals take the maximum. */
export function mergeControls(...all: Controls[]): Controls {
  let steer = 0;
  let throttle = 0;
  let brake = 0;
  for (const c of all) {
    if (Math.abs(c.steer) > Math.abs(steer)) steer = c.steer;
    throttle = Math.max(throttle, c.throttle);
    brake = Math.max(brake, c.brake);
  }
  return { steer, throttle, brake };
}
