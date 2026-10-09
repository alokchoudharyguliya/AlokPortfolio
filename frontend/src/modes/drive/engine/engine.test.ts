import { autopilot } from "./autopilot";
import { DriveGame } from "./game";
import { gamepadControls, keyboardControls, mergeControls, tiltSteer, touchSteer } from "./input";
import { clamp } from "./rng";
import { buildRoute, featureCurvature, GAP, ROAD_HALF, roadPoint, sampleRoute, STEP } from "./route";
import { clock, scoreOf } from "./score";
import { applyBoost, applyCrash, BARRIER, CRUISE, initialVehicle, NO_CONTROLS, OFFROAD_MAX, stepVehicle, stopSpeed } from "./vehicle";
import type { VehicleState } from "./vehicle";
import { buildWorld, nearGate } from "./world";

const KEYS = ["hero", "about", "focus", "experience", "projects", "skills", "education", "achievements", "contact"];

function run(state: VehicleState, seconds: number, input = NO_CONTROLS, curvature = 0, stopIn: number | null = null, dt = 1 / 60) {
  let s = state;
  const events: string[] = [];
  for (let t = 0; t < seconds; t += dt) {
    const r = stepVehicle(s, input, { curvature, stopIn }, dt);
    s = r.state;
    events.push(...r.events.map((e) => e.type));
  }
  return { state: s, events };
}

describe("route", () => {
  const route = buildRoute(KEYS);

  it("puts one checkpoint per section, evenly spaced, starting at 0", () => {
    expect(route.checkpoints.map((c) => c.key)).toEqual(KEYS);
    expect(route.checkpoints[0].s).toBe(0);
    route.checkpoints.slice(1).forEach((c, i) => expect(c.s - route.checkpoints[i].s).toBe(GAP));
    expect(route.length).toBe((KEYS.length - 1) * GAP);
  });

  it("is deterministic for the same sections and different for different ones", () => {
    const again = buildRoute(KEYS);
    expect(Array.from(again.x.slice(0, 50))).toEqual(Array.from(route.x.slice(0, 50)));
    expect(buildRoute(["hero", "contact"]).seed).not.toBe(buildRoute(["hero", "about"]).seed);
  });

  it("keeps every gate on a straight, flat stretch", () => {
    for (const c of route.checkpoints) {
      for (const d of [-140, -100, -50, 0, 50]) {
        const p = sampleRoute(route, c.s + d);
        expect(Math.abs(p.curvature), `${c.key} ${d}`).toBeLessThan(1e-6);
      }
      expect(Math.abs(sampleRoute(route, c.s).slope)).toBeLessThan(0.01);
    }
  });

  it("builds turns in opposite pairs, so the road returns to its heading", () => {
    const total = route.features.reduce((sum, f) => sum + f.angle, 0);
    expect(Math.abs(total)).toBeLessThan(1e-9);
    for (const s of [0, GAP, 3 * GAP, route.length]) {
      expect(Math.abs(sampleRoute(route, s).heading)).toBeLessThan(0.02);
    }
    const maxHeading = Math.max(...Array.from(route.heading).map(Math.abs));
    expect(maxHeading).toBeLessThan(1.0); // never turns more than ~57°
  });

  it("has bends that are tight enough to matter but never tighter than 110 m radius", () => {
    expect(route.features.length).toBeGreaterThan(0);
    const peak = Math.max(...Array.from(route.curvature).map(Math.abs));
    expect(peak).toBeGreaterThan(1 / 400);
    expect(peak).toBeLessThanOrEqual(1 / 105);
  });

  it("feature curvature integrates to the feature angle", () => {
    const f = { start: 0, length: 200, angle: 0.6 };
    let sum = 0;
    for (let s = 0; s < 200; s += 0.5) sum += featureCurvature([f], s) * 0.5;
    expect(sum).toBeCloseTo(0.6, 2);
  });

  it("offsets lateral positions along the road's right-hand normal", () => {
    const straight = roadPoint(route, 0, 4);
    expect(straight.x - sampleRoute(route, 0).x).toBeCloseTo(4, 3); // heading 0 → right is +x
    expect(Math.abs(route.x[1] - route.x[0])).toBeLessThan(STEP);
  });

  it("handles a single-checkpoint route", () => {
    const one = buildRoute(["hero"]);
    expect(one.checkpoints).toHaveLength(1);
    expect(one.length).toBe(0);
    expect(() => sampleRoute(one, 10)).not.toThrow();
  });
});

describe("vehicle", () => {
  it("holds cruise speed with no pedals", () => {
    const { state } = run({ ...initialVehicle(), speed: 5 }, 12);
    expect(state.speed).toBeGreaterThan(CRUISE - 1);
    expect(state.speed).toBeLessThan(CRUISE + 1);
  });

  it("accelerates with throttle and brakes harder than it coasts", () => {
    const fast = run({ ...initialVehicle(), speed: CRUISE }, 3, { steer: 0, throttle: 1, brake: 0 }).state.speed;
    expect(fast).toBeGreaterThan(CRUISE + 8);
    const braked = run({ ...initialVehicle(), speed: CRUISE }, 2, { steer: 0, throttle: 0, brake: 1 }).state.speed;
    expect(braked).toBeLessThan(CRUISE - 20);
    expect(braked).toBeGreaterThanOrEqual(0);
  });

  it("cannot steer while standing still", () => {
    const { state } = run(initialVehicle(), 2, { steer: 1, throttle: 0, brake: 1 });
    expect(Math.abs(state.x)).toBeLessThan(0.01);
  });

  it("steers right with a positive input and left with a negative one", () => {
    const base = { ...initialVehicle(), speed: CRUISE };
    expect(run(base, 1, { steer: 1, throttle: 0, brake: 0 }).state.x).toBeGreaterThan(2);
    expect(run(base, 1, { steer: -1, throttle: 0, brake: 0 }).state.x).toBeLessThan(-2);
  });

  it("is pushed to the outside of a bend (right turn → left)", () => {
    const base = { ...initialVehicle(), speed: CRUISE };
    expect(run(base, 1.5, NO_CONTROLS, 1 / 120).state.x).toBeLessThan(-1);
    expect(run(base, 1.5, NO_CONTROLS, -1 / 120).state.x).toBeGreaterThan(1);
  });

  it("slows down off the tarmac but never gets stuck", () => {
    const off = run({ ...initialVehicle(), x: ROAD_HALF + 1, speed: CRUISE, offRoad: true }, 4).state;
    expect(off.offRoad).toBe(true);
    expect(off.speed).toBeLessThan(CRUISE);
    expect(off.speed).toBeGreaterThan(OFFROAD_MAX - 6);
  });

  it("scrapes the guard rail: bounces back, loses speed, reports it once", () => {
    const { state, events } = run({ ...initialVehicle(), speed: CRUISE, x: BARRIER - 1 }, 1.2, { steer: 1, throttle: 0, brake: 0 });
    expect(events.filter((e) => e === "scrape").length).toBeGreaterThanOrEqual(1);
    expect(Math.abs(state.x)).toBeLessThan(BARRIER);
    expect(state.speed).toBeLessThan(CRUISE);
  });

  it("always stops exactly on the gate line, however fast it arrives", () => {
    for (const start of [10, 30, 60]) {
      let s: VehicleState = { ...initialVehicle(), speed: start };
      const line = 400;
      let seconds = 0;
      while (s.speed > 0 && seconds < 60) {
        s = stepVehicle(s, { steer: 0, throttle: 1, brake: 0 }, { curvature: 0, stopIn: line - s.s }, 1 / 60).state;
        seconds += 1 / 60;
      }
      expect(s.speed).toBe(0);
      expect(s.s).toBeCloseTo(line, 1);
    }
  });

  it("stopSpeed is the speed from which constant braking just reaches the line", () => {
    expect(stopSpeed(0)).toBe(0);
    expect(stopSpeed(50)).toBeCloseTo(30, 0);
  });

  it("boost lifts the speed cap and crashes slow the car", () => {
    const boosted = run(applyBoost({ ...initialVehicle(), speed: CRUISE }), 1.5, { steer: 0, throttle: 1, brake: 0 }).state;
    expect(boosted.speed).toBeGreaterThan(52);
    const hit = applyCrash({ ...initialVehicle(), speed: CRUISE }, 15, 1);
    expect(hit.speed).toBeLessThan(10);
    expect(hit.crashT).toBe(1);
  });
});

describe("autopilot", () => {
  it("keeps the car on the road through every bend of a full route", () => {
    for (const keys of [KEYS, ["hero", "projects", "contact"], KEYS.slice(0, 5)]) {
      const route = buildRoute(keys);
      let v: VehicleState = { ...initialVehicle(), speed: CRUISE };
      let worstX = 0;
      const dt = 1 / 60;
      while (v.s < route.length - 5 && worstX < 100) {
        const road = sampleRoute(route, v.s);
        const stopIn = route.length - v.s;
        v = stepVehicle(v, autopilot(v, road.curvature, null), { curvature: road.curvature, stopIn }, dt).state;
        worstX = Math.max(worstX, Math.abs(v.x));
        if (v.speed === 0) break;
      }
      expect(worstX, keys.join()).toBeLessThan(ROAD_HALF - 1);
    }
  });

  it("would have left the road without steering (so the bends are real)", () => {
    const route = buildRoute(KEYS);
    let v: VehicleState = { ...initialVehicle(), speed: CRUISE };
    let left = false;
    while (v.s < route.length - 5) {
      const road = sampleRoute(route, v.s);
      v = stepVehicle(v, NO_CONTROLS, { curvature: road.curvature, stopIn: route.length - v.s }, 1 / 60).state;
      if (Math.abs(v.x) > ROAD_HALF) left = true;
      if (v.speed === 0) break;
    }
    expect(left).toBe(true);
  });
});

describe("world", () => {
  const route = buildRoute(KEYS);

  it("keeps traffic and pads away from the gates and is deterministic", () => {
    const w = buildWorld(route, { modelCount: 6, traffic: true });
    expect(w.traffic.length).toBeGreaterThan(10);
    expect(w.pads.length).toBeGreaterThan(5);
    expect(w.traffic.some((c) => nearGate(route, c.s))).toBe(false);
    expect(w.pads.some((p) => nearGate(route, p.s, 120, 60))).toBe(false);
    expect(buildWorld(route, { modelCount: 6, traffic: true }).traffic.map((c) => c.s)).toEqual(w.traffic.map((c) => c.s));
  });

  it("builds no traffic when asked not to", () => {
    expect(buildWorld(route, { modelCount: 6, traffic: false }).traffic).toHaveLength(0);
  });
});

describe("DriveGame", () => {
  const route = buildRoute(KEYS);

  it("starts parked at the hero with the engine off", () => {
    const game = new DriveGame(route);
    const snap = game.snapshot();
    expect(snap).toMatchObject({ phase: "stopped", index: 0, started: false, speedKmh: 0, progress: 0 });
    expect(game.tick(0.016, { steer: 0, throttle: 1, brake: 0 })).toEqual([]);
    expect(game.vehicle.s).toBe(0);
  });

  it("drives the whole route on autopilot, stopping at every gate in order", () => {
    const game = new DriveGame(route);
    game.autopilot = true;
    const arrivals: number[] = [];
    let guard = 0;
    game.continue();
    while (game.phase !== "finished" && guard++ < 60 * 60 * 10) {
      for (const e of game.tick(1 / 60, NO_CONTROLS)) {
        if (e.type === "arrive") {
          arrivals.push(e.index);
          expect(game.vehicle.s).toBeCloseTo(route.checkpoints[e.index].s, 1);
          expect(game.vehicle.speed).toBe(0);
          expect(Math.abs(game.vehicle.x)).toBeLessThan(ROAD_HALF); // parked on the road
          game.continue();
        }
      }
    }
    expect(arrivals).toEqual(KEYS.map((_, i) => i).slice(1));
    expect(game.phase).toBe("finished");
    expect(game.stats.distance).toBeGreaterThan(route.length - 5);
    expect(game.stats.elapsed).toBeLessThan(5 * 60); // the whole portfolio in under five minutes
  });

  it("autopilot rarely hits anything and overtakes traffic", () => {
    const game = new DriveGame(route);
    game.autopilot = true;
    game.continue();
    for (let i = 0; i < 60 * 60 * 6 && game.phase !== "finished"; i++) {
      for (const e of game.tick(1 / 60, NO_CONTROLS)) if (e.type === "arrive") game.continue();
    }
    expect(game.stats.passes).toBeGreaterThan(3);
    expect(game.stats.crashes).toBeLessThanOrEqual(3);
  });

  it("reports the approach once per gate", () => {
    const game = new DriveGame(route, { calm: true });
    game.autopilot = true;
    game.continue();
    const approaches: number[] = [];
    for (let i = 0; i < 60 * 40 && game.phase === "driving"; i++) {
      for (const e of game.tick(1 / 60, NO_CONTROLS)) if (e.type === "approach") approaches.push(e.index);
    }
    expect(approaches).toEqual([1]);
  });

  it("jumpTo parks at any checkpoint; continue from the last one finishes", () => {
    const game = new DriveGame(route);
    expect(game.jumpTo(4)).toEqual([{ type: "arrive", index: 4 }]);
    expect(game.snapshot()).toMatchObject({ phase: "stopped", index: 4, started: true });
    expect(game.vehicle.s).toBe(route.checkpoints[4].s);
    game.jumpTo(99);
    expect(game.index).toBe(KEYS.length - 1);
    expect(game.continue()).toEqual([{ type: "finish" }]);
    expect(game.phase).toBe("finished");
  });

  it("calm mode has no traffic or pads and a slower cruise", () => {
    const game = new DriveGame(route, { calm: true });
    expect(game.world.traffic).toHaveLength(0);
    expect(game.world.pads).toHaveLength(0);
    game.continue();
    for (let i = 0; i < 60 * 12; i++) game.tick(1 / 60, NO_CONTROLS);
    expect(game.vehicle.speed).toBeLessThan(CRUISE - 5);
  });

  it("restart resets everything", () => {
    const game = new DriveGame(route);
    game.jumpTo(5);
    game.stats.crashes = 4;
    game.restart();
    expect(game.snapshot()).toMatchObject({ phase: "stopped", index: 0, started: false });
    expect(game.stats.crashes).toBe(0);
  });

  it("clamps huge time steps (a backgrounded tab)", () => {
    const game = new DriveGame(route);
    game.continue();
    game.tick(30, NO_CONTROLS);
    expect(game.vehicle.s).toBeLessThan(5);
  });
});

describe("score", () => {
  it("rewards distance, boosts and overtakes, penalises crashes, never goes negative", () => {
    expect(scoreOf({ distance: 1000, boosts: 2, crashes: 1, passes: 5, elapsed: 60 })).toBe(100 + 100 + 50 - 30);
    expect(scoreOf({ distance: 0, boosts: 0, crashes: 9, passes: 0, elapsed: 0 })).toBe(0);
    expect(clock(125)).toBe("2:05");
  });
});

describe("input devices", () => {
  it("maps arrows and WASD", () => {
    expect(keyboardControls(new Set(["ArrowLeft", "ArrowUp"]))).toEqual({ steer: -1, throttle: 1, brake: 0 });
    expect(keyboardControls(new Set(["d", "s"]))).toEqual({ steer: 1, throttle: 0, brake: 1 });
    expect(keyboardControls(new Set(["ArrowLeft", "ArrowRight"])).steer).toBe(0);
  });

  it("steers by the half of the screen that is held", () => {
    expect(touchSteer([100], 800)).toBe(-1);
    expect(touchSteer([700], 800)).toBe(1);
    expect(touchSteer([100, 700], 800)).toBe(0);
    expect(touchSteer([], 800)).toBe(0);
  });

  it("maps tilt with a dead zone, neutral point, landscape flip and invert", () => {
    expect(tiltSteer({ beta: 0, gamma: 20 }, 0)).toBeCloseTo(0.8);
    expect(tiltSteer({ beta: 0, gamma: 1 }, 0)).toBe(0);
    expect(tiltSteer({ beta: 0, gamma: 40 }, 0)).toBe(1);
    expect(tiltSteer({ beta: 30, gamma: 0 }, 90, 5)).toBeCloseTo(1);
    expect(tiltSteer({ beta: 20, gamma: 0 }, -90)).toBeCloseTo(-0.8);
    expect(tiltSteer({ beta: 0, gamma: 20 }, 0, 0, true)).toBeCloseTo(-0.8);
  });

  it("maps a gamepad: stick dead zone, triggers, d-pad", () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[7] = { pressed: true, value: 0.6 };
    expect(gamepadControls({ axes: [0.05, 0], buttons })).toEqual({ steer: 0, throttle: 0.6, brake: 0 });
    expect(gamepadControls({ axes: [-0.7, 0], buttons }).steer).toBe(-0.7);
    buttons[15] = { pressed: true, value: 1 };
    expect(gamepadControls({ axes: [0, 0], buttons }).steer).toBe(1);
  });

  it("merges sources: strongest steer, highest pedals", () => {
    expect(mergeControls({ steer: 0.3, throttle: 0, brake: 0 }, { steer: -1, throttle: 1, brake: 0 })).toEqual({ steer: -1, throttle: 1, brake: 0 });
  });

  it("clamp helper", () => expect(clamp(5, 0, 1)).toBe(1));
});
