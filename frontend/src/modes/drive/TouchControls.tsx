/**
 * Touch (and mouse-hold) steering: press and hold the left or right half of the
 * screen. Both halves held = straight. The car accelerates by itself (cruise
 * control), so steering is the only thing a phone visitor has to do.
 * Optional on-screen gas / brake buttons for manual speed control.
 *
 * It only writes into the refs the game loop reads (`touch`, `pedals`); nothing
 * here re-renders while driving except the two highlight states.
 */
import clsx from "clsx";
import { useRef, useState } from "react";
import type { PointerEvent } from "react";

import type { PedalState } from "./useDrive";
import styles from "./Drive.module.css";

export function TouchControls({
  onTouch,
  onPedal,
  enabled,
  showPedals,
}: {
  onTouch: (xs: number[], width: number) => void;
  onPedal: (key: keyof PedalState, down: boolean) => void;
  enabled: boolean;
  showPedals: boolean;
}) {
  const fingers = useRef(new Map<number, number>());
  const [side, setSide] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  const sync = () => {
    const xs = [...fingers.current.values()];
    onTouch(xs, window.innerWidth);
    const half = window.innerWidth / 2;
    setSide({ left: xs.some((x) => x < half), right: xs.some((x) => x >= half) });
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    fingers.current.set(e.pointerId, e.clientX);
    sync();
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (fingers.current.has(e.pointerId)) {
      fingers.current.set(e.pointerId, e.clientX);
      sync();
    }
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    fingers.current.delete(e.pointerId);
    sync();
  };

  const pedal = (key: keyof PedalState) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      onPedal(key, true);
    },
    onPointerUp: () => onPedal(key, false),
    onPointerCancel: () => onPedal(key, false),
    onPointerLeave: () => onPedal(key, false),
  });

  if (!enabled) return null;
  return (
    <>
      <div className={styles.zones} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
        <span className={clsx(styles.zone, styles.zoneLeft, side.left && styles.zoneOn)} aria-hidden>
          ‹
        </span>
        <span className={clsx(styles.zone, styles.zoneRight, side.right && styles.zoneOn)} aria-hidden>
          ›
        </span>
      </div>
      {showPedals ? (
        <div className={styles.pedals}>
          <button type="button" className={styles.pedal} aria-label="Brake" {...pedal("brake")}>
            Brake
          </button>
          <button type="button" className={clsx(styles.pedal, styles.gas)} aria-label="Gas" {...pedal("gas")}>
            Gas
          </button>
        </div>
      ) : null}
    </>
  );
}
