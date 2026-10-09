/**
 * 3D mode chrome.
 *
 *   <canvas>                 fixed behind everything: the GPU-die world (scene/Engine)
 *   header                   brand + mode switch + theme toggle
 *   main                     the page's stations (views.tsx) in glass panels
 *   rail  (wide screens)     the page as a call stack: `main → about() → projects() …`, current frame highlighted
 *   readout                  one honest number about the section in view, counted up with anime.js
 *
 * Scroll (GSAP ScrollTrigger over Lenis) → fractional station index → camera
 * flight. If WebGL is unavailable or the context is lost, `failed` flips and
 * everything except the canvas keeps working.
 */
import { animate } from "animejs";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import type { Bootstrap } from "@/api/types";
import { buildSections } from "@/domain/sections";
import { SmoothScroll } from "@/lib/motion/SmoothScroll";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import { SocialLinks } from "@/modes/simple/parts";
import { useSudo } from "@/sudo/SudoProvider";
import { Button } from "@/ui/Button";
import { ModeSwitcher } from "@/ui/ModeSwitcher";
import { ThemeToggle } from "@/ui/ThemeToggle";

import { SceneContext } from "./SceneContext";
import type { SceneApi } from "./SceneContext";
import { readoutFor } from "./readout";
import type { Readout } from "./readout";
import styles from "./Three.module.css";
import { useSceneEngine } from "./useSceneEngine";
import { useScrollFlight } from "./useScrollFlight";

export default function ThreeLayout({ bootstrap, children }: { bootstrap: Bootstrap; children: ReactNode }) {
  const location = useLocation();
  const home = location.pathname === "/";
  const reduced = useReducedMotion();
  const { editing } = useSudo();
  const { setMode } = usePreferences();
  const sceneHost = useRef<HTMLDivElement>(null);

  const content = useMemo(
    () => ({ projects: bootstrap.projects.length, experiences: bootstrap.experience.length, tiers: bootstrap.skills.length }),
    [bootstrap.projects.length, bootstrap.experience.length, bootstrap.skills.length],
  );
  const { engineRef, failed } = useSceneEngine(sceneHost, content, reduced);

  // The stations the page renders, in the owner's order (mirrors HomeView's filtering).
  const stations = useMemo(
    () => buildSections(bootstrap).filter((s) => (editing || !s.isEmpty) && (s.key !== "arcade" || editing)),
    [bootstrap, editing],
  );
  const [active, setActive] = useState(0);
  const onStation = useCallback((i: number) => setActive(i), []);
  useScrollFlight(engineRef, home, `${stations.map((s) => s.key).join(",")}|${reduced}`, failed, onStation);

  const scene = useMemo<SceneApi>(
    () => ({
      highlightProject: (i) => engineRef.current?.setProjectHighlight(i),
      highlightTier: (i) => engineRef.current?.setRingHighlight(i),
    }),
    [engineRef],
  );

  // Scroll to top on route change (Lenis-safe), except for in-page hashes.
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0 });
  }, [location.pathname, location.hash]);

  const current = stations[Math.min(active, stations.length - 1)];
  const readout = useMemo(() => (home && current ? readoutFor(current.key, bootstrap) : null), [home, current, bootstrap]);
  const initials = bootstrap.profile.full_name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  return (
    <SceneContext.Provider value={scene}>
      <div className={styles.shell} data-scene={failed ? "off" : "on"}>
        <SmoothScroll />
        {/* The engine mounts its own <canvas> in here (see useSceneEngine). */}
        <div ref={sceneHost} className={styles.canvas} aria-hidden />
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link to="/" className={styles.brand} aria-label={`${bootstrap.profile.full_name}, home`}>
              <span className={styles.monogram} aria-hidden>
                {initials}
              </span>
              <span>{bootstrap.profile.full_name}</span>
            </Link>
            <div className={styles.controls}>
              <ModeSwitcher compact />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {home && stations.length > 1 ? <CallStack items={stations.map((s) => ({ key: s.key, title: s.meta.title }))} active={active} /> : null}
        <ReadoutChip data={readout} />

        <main id="main" className={styles.main}>
          {children}
        </main>

        <footer className={styles.footer}>
          <p>
            © {new Date().getFullYear()} {bootstrap.profile.full_name}
            {bootstrap.site.footer_note ? ` — ${bootstrap.site.footer_note}` : ""}
          </p>
          <SocialLinks links={bootstrap.social_links} />
        </footer>

        {failed ? (
          <p className={styles.notice} role="status">
            The 3D scene couldn't start on this device, so you're seeing the content only.
            <Button size="sm" variant="secondary" onClick={() => setMode("simple")}>
              Use Simple mode
            </Button>
          </p>
        ) : null}
      </div>
    </SceneContext.Provider>
  );
}

/** The page as a call stack; the frame the camera is at is highlighted. Anchors use Lenis' smooth anchor scrolling. */
function CallStack({ items, active }: { items: { key: string; title: string }[]; active: number }) {
  return (
    <nav aria-label="Sections">
      <ol className={styles.rail}>
        {items.map((item, i) => (
          <li key={item.key}>
            <a
              className={clsx(styles.railItem)}
              href={`#${item.key}`}
              aria-current={i === active ? "location" : undefined}
              title={item.title}
            >
              <span className={styles.railMark} aria-hidden>
                {i === active ? "▸" : " "}
              </span>
              {item.key === "hero" ? "main" : `${item.key}()`}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** One real number about the section in view, counted up when it changes. */
function ReadoutChip({ data }: { data: Readout | null }) {
  const number = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = number.current;
    if (!el || !data) return;
    if (reduced) {
      el.textContent = String(data.value);
      return;
    }
    const counter = { v: 0 };
    const anim = animate(counter, {
      v: data.value,
      duration: 900,
      ease: "outExpo",
      onUpdate: () => {
        el.textContent = String(Math.round(counter.v));
      },
    });
    return () => {
      anim.cancel();
    };
  }, [data, reduced]);

  if (!data) return null;
  return (
    <div className={styles.readout} aria-hidden>
      <strong ref={number}>{data.value}</strong>
      <span>{data.label}</span>
    </div>
  );
}
