/**
 * The Esc menu. It is also the visitor's way out of any part of the drive:
 * jump to any checkpoint (route map), let the autopilot drive, slow things down
 * (calm mode), adjust touch controls, read the credits, or leave for Simple mode.
 */
import clsx from "clsx";

import { Button } from "@/ui/Button";
import { Drawer } from "@/ui/Drawer";
import { Toggle } from "@/ui/form/inputs";

import type { GameSnapshot } from "./engine/game";
import type { GateLabel } from "./render/DriveRenderer";
import styles from "./Drive.module.css";

export interface PauseMenuProps {
  open: boolean;
  onClose: () => void;
  labels: GateLabel[];
  snap: GameSnapshot;
  onJump: (index: number) => void;
  autopilot: boolean;
  onAutopilot: (on: boolean) => void;
  calm: boolean;
  onCalm: (on: boolean) => void;
  touchDevice: boolean;
  tilt: { on: boolean; enable: () => Promise<boolean>; disable: () => void; recalibrate: () => void; invert: (on: boolean) => void };
  pedals: boolean;
  onPedals: (on: boolean) => void;
  onRestart: () => void;
  onReadAsPage: () => void;
}

export function PauseMenu(p: PauseMenuProps) {
  const jump = (i: number) => {
    p.onJump(i);
    p.onClose();
  };
  return (
    <Drawer
      open={p.open}
      onClose={p.onClose}
      title="Drive menu"
      footer={
        <>
          <Button variant="ghost" onClick={p.onReadAsPage}>
            Read as a page
          </Button>
          <Button variant="primary" onClick={p.onClose}>
            Back to the road
          </Button>
        </>
      }
    >
      <div className={styles.menu}>
        <section aria-labelledby="menu-route">
          <h3 id="menu-route" className={styles.menuHead}>
            Route
          </h3>
          <p className={styles.menuNote}>Jump straight to any checkpoint.</p>
          <ol className={styles.routeList}>
            {p.labels.map((l, i) => {
              const here = p.snap.phase !== "driving" && p.snap.index === i;
              const done = p.snap.started && i < p.snap.index;
              return (
                <li key={i}>
                  <button type="button" className={clsx(styles.routeItem, here && styles.routeHere)} onClick={() => jump(i)} aria-current={here ? "location" : undefined}>
                    <span className={clsx(styles.routeDot, (done || here) && styles.routeDone)} aria-hidden />
                    <span className={styles.routeName}>{l.title}</span>
                    <span className={styles.routeNote}>{here ? "you are here" : done ? "visited" : l.kicker}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="menu-drive" className={styles.menuGroup}>
          <h3 id="menu-drive" className={styles.menuHead}>
            Driving
          </h3>
          <Toggle id="drive-autopilot" checked={p.autopilot} onChange={p.onAutopilot} label="Autopilot (the car drives itself and still stops at every gate)" />
          <Toggle id="drive-calm" checked={p.calm} onChange={p.onCalm} label="Calm mode (slower, no traffic, no camera shake)" />
          {p.touchDevice ? (
            <>
              <Toggle id="drive-pedals" checked={p.pedals} onChange={p.onPedals} label="Show gas and brake buttons" />
              <Toggle
                id="drive-tilt"
                checked={p.tilt.on}
                onChange={(on) => void (on ? p.tilt.enable() : p.tilt.disable())}
                label="Steer by tilting the phone"
              />
              {p.tilt.on ? (
                <div className={styles.menuRow}>
                  <Button size="sm" onClick={p.tilt.recalibrate}>
                    Reset tilt to how I'm holding it
                  </Button>
                  <Toggle id="drive-tilt-invert" checked={false} onChange={p.tilt.invert} label="Reverse tilt direction" />
                </div>
              ) : null}
            </>
          ) : null}
          <div className={styles.menuRow}>
            <Button size="sm" variant="secondary" onClick={() => void (p.onRestart(), p.onClose())}>
              Start over
            </Button>
          </div>
        </section>

        <section aria-labelledby="menu-credits" className={styles.menuGroup}>
          <h3 id="menu-credits" className={styles.menuHead}>
            Credits
          </h3>
          <p className={styles.menuNote}>
            Cars, trees, lamps and rails are low-poly models from{" "}
            <a href="https://kenney.nl/assets/car-kit" target="_blank" rel="noreferrer noopener">
              Kenney's Car Kit
            </a>{" "}
            and{" "}
            <a href="https://kenney.nl/assets/racing-kit" target="_blank" rel="noreferrer noopener">
              Racing Kit
            </a>{" "}
            (CC0, public domain). The cockpit, road, sky and gates are drawn in code.
          </p>
        </section>
      </div>
    </Drawer>
  );
}
