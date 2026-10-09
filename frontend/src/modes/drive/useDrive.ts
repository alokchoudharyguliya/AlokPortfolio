/**
 * useDrive — React's single point of contact with the drive.
 *
 *   route + labels ──► DriveGame (engine/)      state machine, physics, traffic
 *                  └─► DriveRenderer (render/)  three.js world, created when assets are loaded
 *   one requestAnimationFrame loop: read inputs → game.tick → renderer.render → write cockpit CSS vars
 *
 * React only sees a throttled `snapshot` (about 10 per second, immediately on events), so steering
 * and speed never cause re-renders; the cockpit is animated through CSS custom properties
 * (`--steer`, `--speed`, `--boost`) set directly on `cockpitRef`.
 *
 * The game is rebuilt when the route changes (the owner reordered sections) or calm mode toggles,
 * carrying over the current checkpoint so a visitor never loses their place.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { qualityTier } from "@/lib/device";

import { DriveGame } from "./engine/game";
import type { GameEvent, GameSnapshot } from "./engine/game";
import { DRIVE_KEYS, gamepadControls, keyboardControls, mergeControls, NEUTRAL, tiltSteer, touchSteer } from "./engine/input";
import type { PadLike } from "./engine/input";
import type { Route } from "./engine/route";
import type { Controls } from "./engine/vehicle";
import { loadAssets } from "./render/assets";
import type { DriveAssets } from "./render/assets";
import { DriveRenderer } from "./render/DriveRenderer";
import type { GateLabel } from "./render/DriveRenderer";
import type { RGB } from "./render/palette";
import { driveQuality } from "./render/quality";


export type DriveStatus = "loading" | "ready" | "failed";

export interface TouchState {
  /** x positions (px) of fingers currently down on the steering surface. */
  xs: number[];
  width: number;
}

export interface PedalState {
  gas: boolean;
  brake: boolean;
}

export interface UseDriveOptions {
  route: Route;
  labels: GateLabel[];
  /** Whether the car should respond (false while a detail page or menu is open). */
  active: boolean;
  calm: boolean;
  accent: RGB;
  /** True for the dark theme (night drive). */
  night: boolean;
}

let assetsPromise: Promise<DriveAssets> | null = null;
const getAssets = () => (assetsPromise ??= loadAssets());

const INTERACTIVE = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (INTERACTIVE.has(t.tagName) || t.isContentEditable);

export function useDrive(options: UseDriveOptions) {
  const { route, labels, active, calm, accent, night } = options;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cockpitRef = useRef<HTMLElement | null>(null);
  const gameRef = useRef<DriveGame | null>(null);
  const rendererRef = useRef<DriveRenderer | null>(null);
  const activeRef = useRef(active);
  const keys = useRef(new Set<string>());
  const touch = useRef<TouchState>({ xs: [], width: 1 });
  const pedals = useRef<PedalState>({ gas: false, brake: false });
  const tilt = useRef<{ beta: number | null; gamma: number | null; on: boolean; neutral: number; fresh: boolean; invert: boolean }>({
    beta: null,
    gamma: null,
    on: false,
    neutral: 0,
    fresh: false,
    invert: false,
  });
  const listeners = useRef(new Set<(e: GameEvent) => void>());
  const carry = useRef<{ index: number; started: boolean; autopilot: boolean } | null>(null);
  const nightRef = useRef(night);
  const accentRef = useRef(accent);

  const [status, setStatus] = useState<DriveStatus>(() => (qualityTier() === "none" ? "failed" : "loading"));
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [tiltOn, setTiltOn] = useState(false);
  const [assets, setAssets] = useState<DriveAssets | null>(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    nightRef.current = night;
    rendererRef.current?.setNight(night ? 1 : 0);
  }, [night]);
  useEffect(() => {
    accentRef.current = accent;
    rendererRef.current?.setAccent(accent);
  }, [accent]);

  // Load the models once per session (failures leave slots empty; the scene copes).
  useEffect(() => {
    if (status === "failed") return;
    let cancelled = false;
    getAssets()
      .then((a) => !cancelled && setAssets(a))
      .catch(() => !cancelled && setAssets({ cars: [], trees: [], lamp: null, rail: null, cone: null, flag: null }));
    return () => {
      cancelled = true;
    };
  }, [status]);

  const routeSignature = useMemo(() => route.keys.join("|"), [route]);

  // The game + renderer + loop. Rebuilt for a new route or calm toggle; the visitor keeps their checkpoint.
  useEffect(() => {
    const host = hostRef.current;
    const quality = driveQuality(qualityTier());
    if (!host || !quality || !assets) return;

    const game = new DriveGame(route, { calm, modelCount: Math.max(1, assets.cars.length) });
    const saved = carry.current ?? (gameRef.current ? { index: gameRef.current.index, started: gameRef.current.started, autopilot: gameRef.current.autopilot } : null);
    if (saved?.started) game.jumpTo(Math.min(saved.index, game.last));
    game.autopilot = Boolean(saved?.autopilot);
    gameRef.current = game;

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(canvas);

    let renderer: DriveRenderer;
    try {
      renderer = new DriveRenderer(canvas, {
        quality,
        calm,
        route,
        assets,
        labels,
        accent: accentRef.current,
        night: nightRef.current ? 1 : 0,
        onContextLost: () => setStatus("failed"),
      });
    } catch {
      canvas.remove();
      queueMicrotask(() => setStatus("failed"));
      return;
    }
    rendererRef.current = renderer;
    const size = () => renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    queueMicrotask(() => setStatus("ready"));

    // ---- input -----------------------------------------------------------
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (DRIVE_KEYS.has(e.key)) {
        keys.current.add(e.key);
        if (activeRef.current) e.preventDefault(); // arrows must not scroll the page
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);

    let prevPad = { a: false };
    const gather = (): Controls => {
      const sources: Controls[] = [keyboardControls(keys.current)];
      const t = touch.current;
      if (t.xs.length) sources.push({ steer: touchSteer(t.xs, t.width), throttle: 0, brake: 0 });
      if (pedals.current.gas || pedals.current.brake) sources.push({ steer: 0, throttle: pedals.current.gas ? 1 : 0, brake: pedals.current.brake ? 1 : 0 });
      if (tilt.current.on && tilt.current.fresh) {
        const angle = screen.orientation?.angle ?? 0;
        sources.push({ steer: tiltSteer(tilt.current, angle, tilt.current.neutral, tilt.current.invert), throttle: 0, brake: 0 });
      }
      const pad = navigator.getGamepads?.().find((p) => p && p.connected);
      if (pad) {
        sources.push(gamepadControls(pad as unknown as PadLike));
        const a = Boolean(pad.buttons[0]?.pressed);
        if (a && !prevPad.a && game.phase === "stopped" && activeRef.current) emit(game.continue());
        prevPad = { a };
      }
      return sources.length > 1 ? mergeControls(...sources) : sources[0] ?? NEUTRAL;
    };

    const emit = (events: GameEvent[]) => {
      for (const e of events) listeners.current.forEach((fn) => fn(e));
      if (events.length) setSnap(game.snapshot());
    };

    // ---- loop ------------------------------------------------------------
    let raf = 0;
    let last = performance.now();
    let lastSnap = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (activeRef.current && !document.hidden) emit(game.tick(dt, gather()));
      renderer.render({ vehicle: game.vehicle, world: game.world, targetIndex: game.targetIndex, boosting: game.vehicle.boostT > 0, dt });

      const el = cockpitRef.current;
      if (el) {
        el.style.setProperty("--steer", game.vehicle.steer.toFixed(3));
        el.style.setProperty("--speed", Math.min(1, game.vehicle.speed / 66).toFixed(3));
        el.style.setProperty("--boost", game.vehicle.boostT > 0 ? "1" : "0");
        el.style.setProperty("--crash", Math.min(1, game.vehicle.crashT).toFixed(2));
        const turn = game.vehicle.steer > 0.45 ? "right" : game.vehicle.steer < -0.45 ? "left" : "";
        if (el.dataset.turn !== turn) el.dataset.turn = turn;
      }
      if (now - lastSnap > 100) {
        lastSnap = now;
        setSnap(game.snapshot());
      }
    };
    raf = requestAnimationFrame(loop);
    setSnap(game.snapshot());

    return () => {
      carry.current = { index: game.index, started: game.started, autopilot: game.autopilot };
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      renderer.dispose();
      canvas.remove();
      rendererRef.current = null;
    };
    // labels are derived from the route's sections and change with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSignature, calm, assets]);

  // ---- tilt (needs a user gesture on iOS) ------------------------------------
  const onOrientation = useRef((e: DeviceOrientationEvent) => {
    const t = tilt.current;
    t.beta = e.beta;
    t.gamma = e.gamma;
    if (!t.fresh) {
      const landscape = Math.abs(screen.orientation?.angle ?? 0) === 90;
      t.neutral = (landscape ? e.beta : e.gamma) ?? 0;
      t.fresh = true;
    }
  });

  const enableTilt = useCallback(async (): Promise<boolean> => {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (!DOE) return false;
    try {
      if (typeof DOE.requestPermission === "function" && (await DOE.requestPermission()) !== "granted") return false;
    } catch {
      return false;
    }
    tilt.current.on = true;
    tilt.current.fresh = false;
    window.addEventListener("deviceorientation", onOrientation.current);
    setTiltOn(true);
    return true;
  }, []);

  const disableTilt = useCallback(() => {
    tilt.current.on = false;
    window.removeEventListener("deviceorientation", onOrientation.current);
    setTiltOn(false);
  }, []);

  const recalibrateTilt = useCallback(() => {
    tilt.current.fresh = false;
  }, []);

  const invertTilt = useCallback((on: boolean) => {
    tilt.current.invert = on;
  }, []);

  useEffect(() => () => window.removeEventListener("deviceorientation", onOrientation.current), []);

  // ---- actions -----------------------------------------------------------------
  const act = useCallback((fn: (g: DriveGame) => GameEvent[] | void) => {
    const g = gameRef.current;
    if (!g) return;
    const events = fn(g) ?? [];
    for (const e of events) listeners.current.forEach((l) => l(e));
    setSnap(g.snapshot());
  }, []);

  const actions = useMemo(
    () => ({
      /** Leave the checkpoint the car is parked at (starts the engine the first time). */
      continue: () => act((g) => g.continue()),
      jumpTo: (i: number) => act((g) => g.jumpTo(i)),
      restart: () => act((g) => g.restart()),
      setAutopilot: (on: boolean) => act((g) => void (g.autopilot = on)),
    }),
    [act],
  );

  const setTouch = useCallback((xs: number[], width: number) => {
    touch.current = { xs, width };
  }, []);
  const setPedal = useCallback((key: keyof PedalState, down: boolean) => {
    pedals.current[key] = down;
  }, []);

  const subscribe = useCallback((fn: (e: GameEvent) => void) => {
    listeners.current.add(fn);
    return () => void listeners.current.delete(fn);
  }, []);

  // Callback refs: the layout hands these to elements without ever touching `.current` during render.
  const attachHost = useCallback((el: HTMLDivElement | null) => {
    hostRef.current = el;
  }, []);
  const attachCockpit = useCallback((el: HTMLElement | null) => {
    cockpitRef.current = el;
  }, []);

  return {
    attachHost,
    attachCockpit,
    status,
    snap,
    actions,
    subscribe,
    setTouch,
    setPedal,
    tilt: { on: tiltOn, enable: enableTilt, disable: disableTilt, recalibrate: recalibrateTilt, invert: invertTilt },
  };
}
