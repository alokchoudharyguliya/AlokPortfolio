/**
 * Car physics: deliberately arcade and forgiving. Pure functions, no DOM.
 *
 * Longitudinal
 *   - With no pedal pressed, a gentle cruise control holds CRUISE speed, so the
 *     page always "moves forward" (the visitor only has to steer).
 *   - Up adds power, Down brakes. Drag limits top speed; a boost pad lifts the cap.
 *   - Off the tarmac the car slows to OFFROAD_MAX. Barriers scrape and slow it. There is
 *     no way to get stuck or to lose.
 *   - `stopIn` (metres to the next gate) caps speed at sqrt(2·a·d), so the car always
 *     comes to rest exactly on the gate line, however fast the visitor arrives.
 *
 * Lateral
 *   - Steering accelerates the car sideways, scaled by speed ("grip": no steering at a standstill).
 *   - A bend pushes the car toward the outside: κ·v²·CURVE_PUSH. Right turn (κ > 0) pushes left.
 *   - Damping turns that into a smooth terminal sideways speed instead of an endless slide.
 */
import { ROAD_HALF } from "./route";
import { clamp } from "./rng";

export const CRUISE = 30; // m/s ≈ 108 km/h
export const CALM_CRUISE = 20;
export const MAX_SPEED = 52;
export const BOOST_SPEED = 66;
export const OFFROAD_MAX = 20;
export const BARRIER = 9; // |x| at which the guard rail is
const ACCEL = 14;
const BRAKE = 28;
const DRAG = 0.0045;
const ROLL = 0.6;
const BOOST_ACCEL = 18;
const STOP_DECEL = 9; // comfortable auto-braking into a gate, m/s²
const STEER_RATE = 4.5; // how fast the wheel follows the input, 1/s
const STEER_ACCEL = 36;
const LAT_DAMP = 4;
const CURVE_PUSH = 2.5;

export interface VehicleState {
  /** Distance along the road, m. */
  s: number;
  /** Lateral position, m (+ right). */
  x: number;
  /** Lateral velocity, m/s. */
  vx: number;
  speed: number;
  /** Wheel angle after smoothing, −1…1. */
  steer: number;
  /** Seconds of boost left. */
  boostT: number;
  /** Seconds since the last crash (decays to 0); drives the camera shake and red flash. */
  crashT: number;
  offRoad: boolean;
}

export interface Controls {
  /** −1 (left) … 1 (right) */
  steer: number;
  /** 0…1 */
  throttle: number;
  /** 0…1 */
  brake: number;
}

export type VehicleEvent = { type: "scrape" };

export interface StepOptions {
  /** Road curvature at the car, 1/m. */
  curvature: number;
  /** Metres to the stop line of the next gate; the car is capped so it can stop there. */
  stopIn?: number | null;
  /** Calm mode: lower cruise speed. */
  calm?: boolean;
}

export const NO_CONTROLS: Controls = { steer: 0, throttle: 0, brake: 0 };

export function initialVehicle(s = 0): VehicleState {
  return { s, x: 0, vx: 0, speed: 0, steer: 0, boostT: 0, crashT: 0, offRoad: false };
}

/** The fastest the car may be going with `d` metres left to stop in. */
export function stopSpeed(d: number): number {
  return Math.sqrt(2 * STOP_DECEL * Math.max(0, d));
}

export function stepVehicle(prev: VehicleState, input: Controls, opts: StepOptions, dt: number): { state: VehicleState; events: VehicleEvent[] } {
  const events: VehicleEvent[] = [];
  const s0 = prev;
  const steerIn = clamp(input.steer, -1, 1);
  const cruise = opts.calm ? CALM_CRUISE : CRUISE;

  // --- speed -------------------------------------------------------------
  const boosting = s0.boostT > 0;
  const maxSpeed = boosting ? BOOST_SPEED : MAX_SPEED;
  let a: number;
  if (input.throttle <= 0 && input.brake <= 0) {
    a = clamp(0.8 * (cruise - s0.speed), -8, 6); // cruise control (drag is cancelled by the controller)
  } else {
    a = ACCEL * input.throttle - BRAKE * input.brake - (DRAG * s0.speed * s0.speed + ROLL);
  }
  if (boosting) a += BOOST_ACCEL;
  if (s0.offRoad && s0.speed > OFFROAD_MAX) a -= 10;
  let speed = clamp(s0.speed + a * dt, 0, maxSpeed);

  // --- steering and sideways motion ---------------------------------------
  const steerDelta = clamp(steerIn - s0.steer, -STEER_RATE * dt, STEER_RATE * dt);
  const steer = s0.steer + steerDelta;
  const grip = clamp(speed / 10, 0, 1);
  let vx = s0.vx + (steer * STEER_ACCEL * grip - opts.curvature * speed * speed * CURVE_PUSH) * dt;
  vx *= Math.exp(-LAT_DAMP * dt);
  let x = s0.x + vx * dt;

  // --- guard rails: scrape, bounce, slow down ------------------------------
  let crashT = Math.max(0, s0.crashT - dt);
  if (Math.abs(x) >= BARRIER) {
    x = Math.sign(x) * (BARRIER - 0.4);
    vx = -vx * 0.3;
    speed *= 0.6;
    if (crashT < 0.3) events.push({ type: "scrape" });
    crashT = 1;
  }

  // --- stopping at the gate ------------------------------------------------
  let s = s0.s + speed * dt;
  if (opts.stopIn != null) {
    const remaining = opts.stopIn - (s - s0.s);
    const allowed = stopSpeed(remaining);
    if (speed > allowed) speed = allowed;
    if (remaining <= 0.15) {
      speed = 0;
      s = s0.s + opts.stopIn; // land exactly on the line
    }
  }

  return {
    state: {
      s,
      x,
      vx,
      speed,
      steer,
      boostT: Math.max(0, s0.boostT - dt),
      crashT,
      offRoad: Math.abs(x) > ROAD_HALF + 0.2,
    },
    events,
  };
}

/** Hit by something (traffic): slow down, get shoved sideways, flash. */
export function applyCrash(state: VehicleState, otherSpeed: number, pushDir: number): VehicleState {
  return {
    ...state,
    speed: Math.min(state.speed, Math.max(0, otherSpeed * 0.6)),
    vx: state.vx + pushDir * 3,
    crashT: 1,
  };
}

export function applyBoost(state: VehicleState): VehicleState {
  return { ...state, boostT: 1.8 };
}

/** Metres per second to km/h, rounded for the speedometer. */
export const toKmh = (mps: number) => Math.round(mps * 3.6);
