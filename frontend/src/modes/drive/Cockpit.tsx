/**
 * The car's interior, drawn over the 3D view: roof edge with a rear-view mirror,
 * A-pillars, a faceted dashboard, instrument cluster and steering wheel. Faceted
 * polygons keep to the low-poly style of the world outside, and no raster art
 * is needed (so it costs no download).
 *
 * Animation is CSS-only: the render loop writes `--steer`, `--speed`, `--boost`
 * and `--crash` (and `data-turn`) on the root element, and everything below reads
 * them, so steering at 60 fps never re-renders React. Only the speed number is
 * a prop (updated about 10×/s).
 */
import clsx from "clsx";

import styles from "./Cockpit.module.css";

const TICKS = Array.from({ length: 28 }, (_, i) => {
  const a = ((-135 + (270 * i) / 27) * Math.PI) / 180;
  const major = i % 3 === 0;
  const r1 = 58;
  const r2 = major ? 47 : 52;
  return { x1: 500 + Math.sin(a) * r1, y1: 150 - Math.cos(a) * r1, x2: 500 + Math.sin(a) * r2, y2: 150 - Math.cos(a) * r2, major, hot: i > 21 };
});

export function Cockpit({
  rootRef,
  speedKmh,
  boosting,
  autopilot,
}: {
  rootRef: (el: HTMLElement | null) => void;
  speedKmh: number;
  boosting: boolean;
  autopilot: boolean;
}) {
  return (
    <section ref={rootRef} className={styles.cockpit} aria-hidden>
      <div className={styles.crash} />
      <div className={clsx(styles.speedLines, boosting && styles.on)} />
      <div className={styles.roof}>
        <div className={styles.mirror}>
          <span className={styles.mirrorGlass} />
        </div>
      </div>
      <div className={clsx(styles.pillar, styles.left)} />
      <div className={clsx(styles.pillar, styles.right)} />

      <svg className={styles.dash} viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="dash-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2531" />
            <stop offset="1" stopColor="#0b1017" />
          </linearGradient>
          <linearGradient id="rim-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b4a5c" />
            <stop offset="0.5" stopColor="#141b24" />
          </linearGradient>
          <radialGradient id="screen" cx="0.5" cy="0.45" r="0.6">
            <stop offset="0" stopColor="#0f1b28" />
            <stop offset="1" stopColor="#04070b" />
          </radialGradient>
        </defs>

        {/* dashboard body and facets */}
        <polygon points="-2200,300 -2200,214 -900,196 0,176 140,146 330,124 500,116 670,124 860,146 1000,176 1900,196 3200,214 3200,300" fill="url(#dash-top)" />
        <polygon points="-2200,214 -900,196 0,176 140,146 170,300 -2200,300" fill="#101821" />
        <polygon points="140,146 330,124 300,300 170,300" fill="#0d141c" />
        <polygon points="3200,214 1900,196 1000,176 860,146 830,300 3200,300" fill="#101821" />
        <polygon points="860,146 670,124 700,300 830,300" fill="#0d141c" />
        <polygon points="330,124 500,116 500,300 300,300" fill="#0a1017" opacity="0.8" />
        <polygon points="500,116 670,124 700,300 500,300" fill="#0c131b" opacity="0.8" />
        <polyline points="-2200,214 -900,196 0,176 140,146 330,124 500,116 670,124 860,146 1000,176 1900,196 3200,214" fill="none" stroke="var(--signal)" strokeWidth="2.5" opacity="0.7" />
        <polyline points="-2200,222 -900,204 0,184 140,154 330,132 500,124 670,132 860,154 1000,184 1900,204 3200,222" fill="none" stroke="var(--signal)" strokeWidth="1" opacity="0.25" />

        {/* instrument hood and cluster */}
        <path d="M372 206 Q372 86 436 82 L564 82 Q628 86 628 206 Z" fill="#070b10" />
        <path d="M384 200 Q384 96 440 92 L560 92 Q616 96 616 200 Z" fill="url(#screen)" />
        <circle cx="500" cy="150" r="62" fill="none" stroke="#1d2a38" strokeWidth="1.5" />
        {TICKS.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.hot ? "var(--signal)" : "#7e93a8"} strokeWidth={t.major ? 2.2 : 1.2} strokeLinecap="round" />
        ))}
        <g className={styles.needle}>
          <polygon points="498,154 502,154 501,94 499,94" fill="var(--signal)" />
          <circle cx="500" cy="150" r="5" fill="#0b1017" stroke="var(--signal)" strokeWidth="1.5" />
        </g>
        <text x="500" y="184" textAnchor="middle" className={styles.speedNumber}>
          {speedKmh}
        </text>
        <text x="500" y="196" textAnchor="middle" className={styles.speedUnit}>
          km/h
        </text>
        <polygon className={clsx(styles.turn, styles.turnLeft)} points="404,142 424,130 424,154" />
        <polygon className={clsx(styles.turn, styles.turnRight)} points="596,142 576,130 576,154" />
        <text x="500" y="108" textAnchor="middle" className={clsx(styles.tag, autopilot && styles.tagOn)}>
          {autopilot ? "AUTOPILOT" : boosting ? "BOOST" : ""}
        </text>

        {/* steering wheel: centre sits below the visible area, so only the top arc shows */}
        <g className={styles.wheel}>
          <circle cx="500" cy="372" r="152" fill="none" stroke="#0a0f15" strokeWidth="34" />
          <circle cx="500" cy="372" r="152" fill="none" stroke="url(#rim-light)" strokeWidth="5" />
          <circle cx="500" cy="372" r="136" fill="none" stroke="#2b3947" strokeWidth="2" strokeDasharray="3 6" />
          <polygon points="470,334 530,334 540,372 460,372" fill="#0e151d" />
          <polygon points="352,364 440,352 452,380 358,386" fill="#0e151d" />
          <polygon points="648,364 560,352 548,380 642,386" fill="#0e151d" />
          <rect x="492" y="213" width="16" height="12" rx="2" fill="var(--signal)" />
          <circle cx="500" cy="366" r="34" fill="#121a23" stroke="var(--signal)" strokeWidth="2" opacity="0.9" />
        </g>
      </svg>
    </section>
  );
}
