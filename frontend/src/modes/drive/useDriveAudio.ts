/**
 * Drive's sound: the engine hum follows the car's speed, and game events get their one-shots
 * (gate in view, arrival chime, boost whoosh, crash thud, overtake tick). Everything goes
 * through lib/sound, which is silent until the visitor turns sound on.
 */
import { useEffect } from "react";

import { sound } from "@/lib/sound/synth";

import type { GameEvent, GameSnapshot } from "./engine/game";

export function useDriveAudio(
  subscribe: (fn: (e: GameEvent) => void) => () => void,
  snap: GameSnapshot | null,
  soundOn: boolean,
  active: boolean,
) {
  // One-shots from game events.
  useEffect(
    () =>
      subscribe((e) => {
        switch (e.type) {
          case "depart":
            sound.ignite();
            break;
          case "approach":
            sound.blip();
            break;
          case "arrive":
          case "finish":
            sound.chime();
            break;
          case "boost":
            sound.whoosh();
            break;
          case "scrape":
          case "crash":
            sound.thud();
            break;
          case "pass":
            sound.tick();
            break;
        }
      }),
    [subscribe],
  );

  // The engine runs while sound is on and the engine has been started; it idles when parked.
  const started = Boolean(snap?.started);
  useEffect(() => {
    if (!soundOn || !started || !active) {
      sound.engine.stop();
      return;
    }
    sound.engine.start();
    return () => sound.engine.stop();
  }, [soundOn, started, active]);

  const speed = snap?.speedKmh ?? 0;
  const boosting = Boolean(snap?.boosting);
  const parked = snap ? snap.phase !== "driving" : true;
  useEffect(() => {
    if (soundOn && started && active) sound.engine.set(Math.min(1, speed / 3.6 / 66), boosting, false, parked);
  }, [soundOn, started, active, speed, boosting, parked]);
}
