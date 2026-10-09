/**
 * The page side of an exhibit: what the visitor reads while the camera dives.
 *
 * Live (WebGL running, strong device, motion allowed): a tall section whose
 * inner panel is `position: sticky`, so the page pins while scroll drives the
 * camera down the levels. `data-station` + `data-dive-levels` are what
 * useScrollFlight builds the flight (and the hold) from. The caption and the
 * breadcrumb follow the level in view.
 *
 * Static (no scene, low tier, reduced motion): an ordinary panel listing the
 * levels, so nothing is lost without the 3D.
 */
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { ScrollTrigger } from "@/lib/motion/gsap";

import { useDive } from "../SceneContext";
import styles from "../Three.module.css";
import { exhibitKey } from "./catalog";
import type { ExhibitDef } from "./catalog";
import { levelAt } from "./dive";

export function ExhibitStation({ exhibit }: { exhibit: ExhibitDef }) {
  const { live } = useDive();
  return live ? <LiveDive exhibit={exhibit} /> : <StaticExhibit exhibit={exhibit} />;
}

function LiveDive({ exhibit }: { exhibit: ExhibitDef }) {
  const ref = useRef<HTMLElement>(null);
  const n = exhibit.levels.length;
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => setLevel(levelAt(self.progress * (n - 1), n)),
    });
    return () => trigger.kill();
  }, [n]);

  const current = exhibit.levels[level];
  return (
    <section
      ref={ref}
      id={`exhibit-${exhibit.id}`}
      className={styles.dive}
      style={{ "--dive-levels": n } as CSSProperties}
      data-station={exhibitKey(exhibit.id)}
      data-dive-levels={n}
      aria-label={`${exhibit.kicker}: ${exhibit.title}`}
    >
      <div className={styles.diveStick}>
        <header className={styles.diveHead}>
          <p className={styles.eyebrow}>{exhibit.kicker}</p>
          <h2 className={styles.diveTitle}>{exhibit.title}</h2>
        </header>

        <ol className={styles.diveCrumbs} aria-label="Depth">
          {exhibit.levels.map((l, i) => (
            <li key={l.id} aria-current={i === level ? "step" : undefined} data-passed={i < level}>
              {l.label}
            </li>
          ))}
        </ol>

        <div className={clsx(styles.glass, styles.diveCaption)} aria-live="polite">
          <p className={styles.tierLabel}>
            level {level + 1} / {n}
          </p>
          <h3 className={styles.itemTitle}>{current.label}</h3>
          <p className={styles.body}>{current.caption}</p>
          {level === 0 ? <p className={styles.cue}>{exhibit.blurb}</p> : null}
        </div>
      </div>
    </section>
  );
}

function StaticExhibit({ exhibit }: { exhibit: ExhibitDef }) {
  return (
    <div className={styles.station} data-side="left">
      <div className={clsx(styles.glass, styles.wide)}>
        <section id={`exhibit-${exhibit.id}`} aria-labelledby={`exhibit-${exhibit.id}-title`}>
          <header className={styles.panelHead}>
            <p className={styles.eyebrow}>{exhibit.kicker}</p>
            <h2 id={`exhibit-${exhibit.id}-title`} className={styles.panelTitle}>
              {exhibit.title}
            </h2>
            <p className={styles.panelSub}>{exhibit.blurb}</p>
          </header>
          <ol className={styles.levels}>
            {exhibit.levels.map((l, i) => (
              <li key={l.id}>
                <span className={styles.tierLabel} aria-hidden>
                  level {i + 1}
                </span>
                <h3 className={styles.itemTitle}>{l.label}</h3>
                <p className={styles.muted}>{l.caption}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
