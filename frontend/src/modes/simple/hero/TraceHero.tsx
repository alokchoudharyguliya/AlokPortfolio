/**
 * TraceHero — the signature moment of Simple mode.
 *
 * The owner's career stages (Profile.journey) are drawn as spans in a
 * profiler-style trace (think Chrome tracing / Nsight Systems): one lane per
 * stage, each span starting later and running to "now", because earlier skills
 * keep running underneath. On load a playhead sweeps left→right and each span
 * grows as the playhead reaches it (one GSAP timeline). The last span — the
 * current focus — is the brightest.
 *
 * Hovering or focusing a lane highlights it, like inspecting a span.
 * Reduced motion: the finished trace renders immediately.
 */
import { useEffect, useRef, useState } from "react";

import { gsap } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";

import styles from "./Hero.module.css";

const FLAME = ["var(--flame-1)", "var(--flame-2)", "var(--flame-3)", "var(--flame-4)"];

/** Earlier lanes walk the flame ramp; the current lane always uses the accent. */
function laneColor(i: number, n: number): string {
  const step = n <= 2 ? 0 : Math.round((i / (n - 2)) * (FLAME.length - 1));
  return FLAME[Math.min(FLAME.length - 1, step)];
}

/** Start offset (% of track) for lane i of n — spread across the first 80%. */
export function spanStart(i: number, n: number): number {
  if (n <= 1) return 0;
  return Math.round((i / (n - 1)) * 80);
}

export function TraceHero({ stages }: { stages: string[] }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const n = stages.length;

  useEffect(() => {
    const el = root.current;
    if (!el || n === 0) return;
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set("[data-span]", { scaleX: 1 });
        gsap.set("[data-playhead]", { left: "100%", opacity: 1 });
        return;
      }
      const total = 2.4; // seconds for the playhead to cross the track
      const tl = gsap.timeline({ delay: 0.25 });
      tl.fromTo("[data-playhead]", { left: "0%", opacity: 1 }, { left: "100%", duration: total, ease: "power1.inOut" }, 0);
      el.querySelectorAll<HTMLElement>("[data-span]").forEach((span, i) => {
        const at = (spanStart(i, n) / 100) * total;
        tl.fromTo(span, { scaleX: 0 }, { scaleX: 1, duration: total - at, ease: "power1.inOut" }, at);
        const label = span.closest("li")?.querySelector("[data-lane-label]");
        if (label) tl.fromTo(label, { opacity: 0.25 }, { opacity: 1, duration: 0.3 }, at);
      });
      tl.fromTo("[data-now]", { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.4 }, total - 0.1);
    }, el);
    return () => ctx.revert();
  }, [n, reduced, stages]);

  if (n === 0) return null;

  return (
    <figure className={styles.trace} ref={root} aria-labelledby="trace-caption">
      <figcaption id="trace-caption" className="visually-hidden">
        Career trace, oldest to newest: {stages.join(", ")}. Current focus: {stages[n - 1]}.
      </figcaption>
      <ol className={styles.lanes}>
        {stages.map((stage, i) => {
          const start = spanStart(i, n);
          const current = i === n - 1;
          return (
            <li
              key={`${i}-${stage}`}
              className={styles.lane}
              data-active={active === i || undefined}
              data-current={current || undefined}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              tabIndex={0}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${stage}${current ? " (current focus)" : ""}`}
            >
              <span className={styles.laneLabel} data-lane-label>
                {stage}
              </span>
              <span className={styles.track} aria-hidden>
                <span
                  className={styles.span}
                  data-span
                  style={{ left: `${start}%`, backgroundColor: current ? "var(--signal)" : laneColor(i, n) }}
                />
              </span>
            </li>
          );
        })}
      </ol>
      <div className={styles.axis} aria-hidden>
        <span className={styles.axisTrack}>
          <span className={styles.now} data-now>
            now
          </span>
        </span>
      </div>
      {/* Overlay aligned to the track column; the playhead sweeps across it. */}
      <div className={styles.overlay} aria-hidden>
        <span className={styles.playhead} data-playhead />
      </div>
    </figure>
  );
}
