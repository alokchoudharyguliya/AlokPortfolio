/**
 * DriveGame — the whole drive as a small state machine, independent of React
 * and three.js (so a complete run can be simulated in a unit test).
 *
 *   stopped(i) ──continue()──► driving ──arrives at gate i+1──► stopped(i+1) … ──► finished
 *
 * The car always starts stopped at checkpoint 0 (the hero), with the engine off.
 * While driving, the gate ahead caps the car's speed so it halts exactly on the
 * line; there is no way to drive past a checkpoint, but `jumpTo()` (route map)
 * and the autopilot let a visitor reach any of them quickly.
 *
 * Traffic and pads only advance while driving, so nothing hits a parked car.
 */
import { autopilot } from "./autopilot";
import { sampleRoute } from "./route";
import type { Route } from "./route";
import { EMPTY_STATS, scoreOf } from "./score";
import type { DriveStats } from "./score";
import { applyBoost, applyCrash, initialVehicle, stepVehicle, toKmh } from "./vehicle";
import type { Controls, VehicleState } from "./vehicle";
import { buildWorld, clearAround, hitsCar, stepTraffic, touchesPad } from "./world";
import type { World } from "./world";

export type Phase = "stopped" | "driving" | "finished";

/** Why a drive does not count for the leaderboard (it does not measure driving). */
export type UnrankedReason = "autopilot" | "calm" | "skipped";

export type GameEvent =
  | { type: "approach"; index: number }
  | { type: "arrive"; index: number }
  | { type: "depart"; index: number }
  | { type: "finish" }
  | { type: "scrape" }
  | { type: "crash" }
  | { type: "boost" }
  | { type: "pass" };

export interface GameOptions {
  /** Calm mode: slower, no traffic, no boost pads (for reduced-motion visitors). */
  calm?: boolean;
  /** Number of car models the renderer can draw (traffic picks among them). */
  modelCount?: number;
}

export interface GameSnapshot {
  phase: Phase;
  /** Last checkpoint reached (the one the car is parked at, or just left). */
  index: number;
  /** The checkpoint being driven toward, or the one parked at. */
  targetIndex: number;
  started: boolean;
  speedKmh: number;
  /** Metres to the next gate (0 when parked). */
  distanceToGate: number;
  /** 0…1 along the whole route. */
  progress: number;
  score: number;
  stats: DriveStats;
  boosting: boolean;
  crashT: number;
  autopilot: boolean;
  /** Null when the drive is eligible for the leaderboard. */
  unranked: UnrankedReason | null;
}

const APPROACH_DISTANCE = 170;
const MAX_DT = 0.05;

export class DriveGame {
  readonly route: Route;
  readonly calm: boolean;
  world: World;
  vehicle: VehicleState;
  phase: Phase = "stopped";
  index = 0;
  started = false;
  autopilot = false;
  stats: DriveStats = { ...EMPTY_STATS };
  private usedAutopilot = false;
  private skipped = false;
  private approachSent = -1;
  private readonly modelCount: number;

  constructor(route: Route, options: GameOptions = {}) {
    this.route = route;
    this.calm = Boolean(options.calm);
    this.modelCount = options.modelCount ?? 6;
    this.world = buildWorld(route, { modelCount: this.modelCount, traffic: !this.calm });
    if (this.calm) this.world.pads = [];
    this.vehicle = initialVehicle(0);
  }

  get last(): number {
    return this.route.checkpoints.length - 1;
  }

  get score(): number {
    return scoreOf(this.stats);
  }

  get unranked(): UnrankedReason | null {
    return this.calm ? "calm" : this.usedAutopilot ? "autopilot" : this.skipped ? "skipped" : null;
  }

  /** The checkpoint the car is heading for (while driving) or parked at. */
  get targetIndex(): number {
    return this.phase === "driving" ? Math.min(this.index + 1, this.last) : this.index;
  }

  /** Leave the current checkpoint. From the final one this finishes the drive. */
  continue(): GameEvent[] {
    if (this.phase !== "stopped") return [];
    this.started = true;
    if (this.index >= this.last) {
      this.phase = "finished";
      return [{ type: "finish" }];
    }
    this.phase = "driving";
    this.vehicle = { ...this.vehicle, speed: Math.max(this.vehicle.speed, 2), x: 0, vx: 0 };
    clearAround(this.world, this.vehicle.s);
    return [{ type: "depart", index: this.index }];
  }

  /** Teleport to a checkpoint (route map). The car arrives parked, as if it had driven there. */
  jumpTo(index: number): GameEvent[] {
    const i = Math.max(0, Math.min(index, this.last));
    this.started = true;
    this.skipped = true;
    this.index = i;
    this.phase = "stopped";
    this.vehicle = initialVehicle(this.route.checkpoints[i].s);
    this.approachSent = i;
    clearAround(this.world, this.vehicle.s);
    return [{ type: "arrive", index: i }];
  }

  /** Start over from the hero. */
  restart() {
    this.world = buildWorld(this.route, { modelCount: this.modelCount, traffic: !this.calm });
    if (this.calm) this.world.pads = [];
    this.vehicle = initialVehicle(0);
    this.phase = "stopped";
    this.index = 0;
    this.started = false;
    this.stats = { ...EMPTY_STATS };
    this.usedAutopilot = false;
    this.skipped = false;
    this.approachSent = -1;
  }

  tick(rawDt: number, controls: Controls): GameEvent[] {
    if (this.phase !== "driving") return [];
    const dt = Math.min(rawDt, MAX_DT);
    const events: GameEvent[] = [];
    const target = this.route.checkpoints[Math.min(this.index + 1, this.last)];
    const stopIn = target.s - this.vehicle.s;
    const road = sampleRoute(this.route, this.vehicle.s);

    if (this.autopilot) this.usedAutopilot = true;
    const input = this.autopilot ? autopilot(this.vehicle, road.curvature, this.calm ? null : this.world) : controls;
    const before = this.vehicle.s;
    const stepped = stepVehicle(this.vehicle, input, { curvature: road.curvature, stopIn, calm: this.calm }, dt);
    this.vehicle = stepped.state;
    for (const e of stepped.events) {
      this.stats.crashes++;
      events.push(e);
    }

    if (!this.calm) {
      stepTraffic(this.world, dt);
      for (const car of this.world.traffic) {
        if (hitsCar(this.vehicle, car)) {
          if (this.vehicle.crashT < 0.4) {
            this.stats.crashes++;
            events.push({ type: "crash" });
          }
          this.vehicle = applyCrash(this.vehicle, car.speed, Math.sign(this.vehicle.x - car.x) || 1);
        } else if (!car.passed && car.s < this.vehicle.s - 3) {
          car.passed = true;
          this.stats.passes++;
          events.push({ type: "pass" });
        }
      }
      for (const pad of this.world.pads) {
        if (touchesPad(this.vehicle, pad)) {
          pad.taken = true;
          this.vehicle = applyBoost(this.vehicle);
          this.stats.boosts++;
          events.push({ type: "boost" });
        }
      }
    }

    this.stats.distance += this.vehicle.s - before;
    this.stats.elapsed += dt;

    const remaining = target.s - this.vehicle.s;
    if (remaining < APPROACH_DISTANCE && this.approachSent !== target.index) {
      this.approachSent = target.index;
      events.push({ type: "approach", index: target.index });
    }
    if (remaining <= 0.2 && this.vehicle.speed < 0.5) {
      this.index = target.index;
      this.phase = "stopped";
      this.vehicle = { ...this.vehicle, s: target.s, speed: 0, vx: 0, steer: 0 };
      events.push({ type: "arrive", index: target.index });
    }
    return events;
  }

  snapshot(): GameSnapshot {
    const target = this.route.checkpoints[this.targetIndex];
    return {
      phase: this.phase,
      index: this.index,
      targetIndex: this.targetIndex,
      started: this.started,
      speedKmh: toKmh(this.vehicle.speed),
      distanceToGate: this.phase === "driving" ? Math.max(0, target.s - this.vehicle.s) : 0,
      progress: this.route.length > 0 ? Math.min(1, this.vehicle.s / this.route.length) : 0,
      score: this.score,
      stats: this.stats,
      boosting: this.vehicle.boostT > 0,
      crashT: this.vehicle.crashT,
      autopilot: this.autopilot,
      unranked: this.unranked,
    };
  }
}
