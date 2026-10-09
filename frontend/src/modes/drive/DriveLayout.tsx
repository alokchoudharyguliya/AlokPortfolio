/**
 * Drive mode chrome and orchestration.
 *
 *   <canvas>        fixed behind everything: the road, scenery and gates (render/DriveRenderer)
 *   Cockpit         the car interior over the canvas (CSS-animated by the render loop)
 *   HUD             header, route strip (opens the route map), next-gate line, score / clock, hint
 *   CheckpointPanel the section's content while the car is parked at its gate
 *   FinishPanel     the end screen with stats and leaderboard
 *   PauseMenu       Esc: route map, autopilot, calm mode, touch settings, credits
 *   detail overlay  project / blog pages (reused Simple views) while the car idles
 *
 * The sections the road is built from are exactly the sections the other modes render,
 * in the owner's order: reorder or hide a section in sudo and the road changes.
 * If WebGL is unavailable or the context is lost, the visitor gets a message and a
 * one-click way to the page (Simple mode).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { ROAD_TRIP, startGameSession } from "@/api/games";
import type { Bootstrap } from "@/api/types";
import { buildSections } from "@/domain/sections";
import { track } from "@/lib/analytics";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import { KEYS, storage } from "@/lib/storage";
import { useSudo } from "@/sudo/SudoProvider";
import { Button } from "@/ui/Button";
import { ModeSwitcher } from "@/ui/ModeSwitcher";
import { ThemeToggle } from "@/ui/ThemeToggle";

import { CheckpointPanel } from "./CheckpointPanel";
import { Cockpit } from "./Cockpit";
import { buildRoute } from "./engine/route";
import { FinishPanel } from "./FinishPanel";
import { hudShowsHint } from "./hint";
import { Hint, NextGate, RouteStrip, StatsChip } from "./Hud";
import { PauseMenu } from "./PauseMenu";
import { parseCssColor } from "@/modes/three/scene/palette";
import type { RGB } from "./render/palette";
import type { GateLabel } from "./render/DriveRenderer";
import { TouchControls } from "./TouchControls";
import { useDrive } from "./useDrive";
import styles from "./Drive.module.css";

const DEFAULT_ACCENT: RGB = [0.91, 0.639, 0.239];
const PANEL_DELAY_MS = 420;

const UNRANKED_MESSAGE = {
  autopilot: "Autopilot drives aren't ranked.",
  calm: "Calm mode drives aren't ranked.",
  skipped: "Drives that skipped ahead on the route map aren't ranked.",
} as const;

function readAccent(): RGB {
  const css = getComputedStyle(document.documentElement).getPropertyValue("--signal");
  return (parseCssColor(css) as RGB | null) ?? DEFAULT_ACCENT;
}

export default function DriveLayout({ bootstrap, children }: { bootstrap: Bootstrap; children: ReactNode }) {
  const location = useLocation();
  const home = location.pathname === "/";
  const { editing } = useSudo();
  const { theme, setMode } = usePreferences();
  const reduced = useReducedMotion();

  // ---- the route: one gate per rendered section, in the owner's order ----------------------
  const sections = useMemo(
    () => buildSections(bootstrap).filter((s) => (editing || !s.isEmpty) && (s.key !== "arcade" || editing)),
    [bootstrap, editing],
  );
  const route = useMemo(() => buildRoute(sections.map((s) => s.key)), [sections]);
  const labels = useMemo<GateLabel[]>(
    () =>
      sections.map((s, i) => ({
        title: s.key === "hero" ? bootstrap.profile.full_name : s.meta.title,
        kicker: i === 0 ? "Start" : i === sections.length - 1 ? "Finish" : `${i} of ${sections.length - 1}`,
      })),
    [sections, bootstrap.profile.full_name],
  );

  // ---- preferences -----------------------------------------------------------------------
  const [calmPref, setCalmPref] = useState<string | null>(() => storage.get(KEYS.driveCalm));
  const calm = calmPref === "1" || (calmPref === null && reduced);
  const setCalm = (on: boolean) => {
    storage.set(KEYS.driveCalm, on ? "1" : "0");
    setCalmPref(on ? "1" : "0");
  };
  const [pedalsOn, setPedalsOn] = useState(() => storage.get(KEYS.drivePedals) === "1");
  const setPedals = (on: boolean) => {
    storage.set(KEYS.drivePedals, on ? "1" : "0");
    setPedalsOn(on);
  };
  const touchDevice = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const accent = useMemo(() => readAccent(), [theme, bootstrap.site.accent_color]); // eslint-disable-line react-hooks/exhaustive-deps

  const { attachHost, attachCockpit, snap, status, actions, subscribe, setTouch, setPedal, tilt } = useDrive({
    route,
    labels,
    active: home && !menuOpen,
    calm,
    accent,
    night: theme === "dark",
  });

  // ---- the leaderboard session: opens when the car first leaves the start --------------------
  const [token, setToken] = useState<string | null>(null);
  useEffect(
    () =>
      subscribe((e) => {
        if (e.type !== "depart") return;
        track("game_play", { game: ROAD_TRIP });
        startGameSession(ROAD_TRIP)
          .then((t) => setToken((current) => current ?? t))
          .catch(() => {});
      }),
    [subscribe],
  );
  const restart = useCallback(() => {
    setToken(null);
    actions.restart();
  }, [actions]);
  const readAsPage = useCallback(() => setMode("simple"), [setMode]);

  // ---- panels open shortly after the car stops ----------------------------------------------
  const phase = snap?.phase ?? "stopped";
  const parkedAt = snap?.index ?? 0;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const stopKey = `${phase}:${parkedAt}`;
  const started = Boolean(snap?.started);
  useEffect(() => {
    if (phase === "driving") return; // a new stopKey is generated on arrival, so nothing to reset
    const t = window.setTimeout(() => setReadyKey(stopKey), started ? PANEL_DELAY_MS : 0);
    return () => window.clearTimeout(t);
  }, [stopKey, phase, started]);
  const panelOpen = status === "ready" && home && !menuOpen && phase !== "driving" && readyKey === stopKey;

  // ---- keyboard: Enter drives on, Esc opens the menu ---------------------------------------
  useEffect(() => {
    if (!home) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape" && !e.defaultPrevented) {
        setMenuOpen((open) => !open);
        return;
      }
      if (e.key === "Enter" && panelOpen && !e.repeat && !menuOpen) {
        // Let buttons, links and form fields keep their own Enter behaviour.
        if (t && (t.closest("button, a, input, textarea, select, summary") || t.isContentEditable)) return;
        if (phase === "stopped") {
          e.preventDefault();
          actions.continue();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [home, panelOpen, menuOpen, phase, actions]);

  // The page must not scroll under the arrow keys.
  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, []);

  const model = sections[Math.min(parkedAt, sections.length - 1)];
  const leaderboardOn = bootstrap.games.some((g) => g.slug === ROAD_TRIP);
  const driving = phase === "driving";
  const showHint = Boolean(snap && hudShowsHint(snap));
  const initials = bootstrap.profile.full_name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  return (
    <div className={styles.shell} data-phase={phase} data-calm={calm || undefined}>
      <div ref={attachHost} className={styles.canvas} aria-hidden />
      <Cockpit rootRef={attachCockpit} speedKmh={snap?.speedKmh ?? 0} boosting={Boolean(snap?.boosting)} autopilot={Boolean(snap?.autopilot)} />

      <a className="skip-link" href="#drive-panel">
        Skip to the content
      </a>

      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label={`${bootstrap.profile.full_name}, back to the road`}>
          <span className={styles.monogram} aria-hidden>
            {initials}
          </span>
          <span className={styles.brandName}>{bootstrap.profile.full_name}</span>
        </Link>
        <div className={styles.controls}>
          <ModeSwitcher compact />
          <ThemeToggle />
          <Button variant="ghost" icon="menu" iconOnly aria-label="Drive menu (Esc)" onClick={() => setMenuOpen(true)} />
        </div>
      </header>

      {snap && home && status === "ready" ? (
        <>
          <RouteStrip labels={labels} snap={snap} onOpen={() => setMenuOpen(true)} />
          <NextGate labels={labels} snap={snap} />
          <StatsChip snap={snap} />
          <Hint show={showHint} touch={touchDevice} />
        </>
      ) : null}

      <TouchControls onTouch={setTouch} onPedal={setPedal} enabled={home && driving && !menuOpen} showPedals={pedalsOn && touchDevice} />

      {panelOpen && snap && model && phase === "stopped" ? (
        <div id="drive-panel" className={styles.panelWrap} data-side={parkedAt % 2 === 0 ? "right" : "left"}>
          <CheckpointPanel
            key={model.key}
            model={model}
            bootstrap={bootstrap}
            index={parkedAt}
            total={sections.length}
            started={snap.started}
            isLast={parkedAt >= sections.length - 1}
            touch={touchDevice}
            onContinue={actions.continue}
            onReadAsPage={readAsPage}
          />
        </div>
      ) : null}

      {panelOpen && snap && phase === "finished" ? (
        <div id="drive-panel" className={styles.panelWrap} data-side="right">
          <FinishPanel
            snap={snap}
            leaderboard={leaderboardOn}
            token={token}
            unranked={snap.unranked ? UNRANKED_MESSAGE[snap.unranked] : null}
            onRestart={restart}
            onReadAsPage={readAsPage}
            onBack={() => actions.jumpTo(sections.length - 1)}
          />
        </div>
      ) : null}

      {!home ? (
        <div className={styles.detail} data-lenis-prevent>
          <div className={styles.detailInner}>
            <Link to="/" className={styles.backToRoad}>
              ← Back to the road
            </Link>
            {children}
          </div>
        </div>
      ) : null}

      {snap ? (
        <PauseMenu
          open={menuOpen && home}
          onClose={() => setMenuOpen(false)}
          labels={labels}
          snap={snap}
          onJump={actions.jumpTo}
          autopilot={snap.autopilot}
          onAutopilot={actions.setAutopilot}
          calm={calm}
          onCalm={setCalm}
          touchDevice={touchDevice}
          tilt={tilt}
          pedals={pedalsOn}
          onPedals={setPedals}
          onRestart={restart}
          onReadAsPage={readAsPage}
        />
      ) : null}

      {status === "loading" ? (
        <div className={styles.overlay} role="status">
          <span className={styles.spinner} aria-hidden />
          <p>Warming up the engine…</p>
        </div>
      ) : null}

      {status === "failed" ? (
        <div className={styles.overlay} role="alert">
          <p>The drive couldn't start on this device (it needs WebGL), so here's the page instead.</p>
          <Button variant="primary" onClick={readAsPage}>
            Open the page
          </Button>
        </div>
      ) : null}
    </div>
  );
}
