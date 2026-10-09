/**
 * On-screen readouts: the route progress strip (also the way into the route map),
 * the "next gate" line, score and clock, and a first-drive controls hint.
 * All of it is plain HTML over the canvas; the speedometer lives in the Cockpit.
 */
import clsx from "clsx";

import { clock } from "./engine/score";
import type { GameSnapshot } from "./engine/game";
import type { GateLabel } from "./render/DriveRenderer";
import styles from "./Drive.module.css";

export function RouteStrip({ labels, snap, onOpen }: { labels: GateLabel[]; snap: GameSnapshot; onOpen: () => void }) {
  const n = labels.length;
  return (
    <button type="button" className={styles.strip} onClick={onOpen} aria-label="Open the route map">
      <ol className={styles.stripTrack}>
        {labels.map((l, i) => (
          <li
            key={i}
            className={clsx(styles.stop, i <= snap.index && snap.started && styles.visited, i === snap.targetIndex && styles.current)}
            style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 0}%` }}
            title={l.title}
          />
        ))}
        <li className={styles.carDot} style={{ left: `${snap.progress * 100}%` }} aria-hidden />
      </ol>
    </button>
  );
}

export function NextGate({ labels, snap }: { labels: GateLabel[]; snap: GameSnapshot }) {
  if (snap.phase !== "driving") return null;
  const next = labels[snap.targetIndex];
  const m = Math.round(snap.distanceToGate / 10) * 10;
  return (
    <p className={clsx(styles.next, snap.distanceToGate < 170 && styles.nextNear)} role="status" aria-live="polite">
      <span className={styles.nextName}>{next?.title}</span>
      <span className={styles.nextDist}>{m} m</span>
    </p>
  );
}

export function StatsChip({ snap }: { snap: GameSnapshot }) {
  if (!snap.started) return null;
  return (
    <div className={styles.chip} aria-label="Drive stats">
      <span>
        <strong>{snap.score}</strong> pts
      </span>
      <span>{clock(snap.stats.elapsed)}</span>
    </div>
  );
}

export function Hint({ show, touch }: { show: boolean; touch: boolean }) {
  return (
    <p className={clsx(styles.hint, show && styles.hintOn)} aria-hidden={!show}>
      {touch ? "Hold left or right to steer" : "← → steer   ↑ gas   ↓ brake   Esc menu"}
    </p>
  );
}
