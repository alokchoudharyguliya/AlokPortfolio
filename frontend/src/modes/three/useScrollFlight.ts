/**
 * Connects page scroll to the camera. Every element marked `data-station` is
 * a stop on the flight; the owner's section order therefore decides the route.
 * On detail pages (project, post, 404) the camera rests on a calm wide shot.
 *
 * A station with `data-dive-levels="N"` is a pinned exhibit: the camera parks
 * on it for the element's whole sticky travel while scroll drives the dive
 * depth (see exhibits/dive.ts), then flies on to the next station.
 */
import { useEffect } from "react";
import type { RefObject } from "react";

import { ScrollTrigger } from "@/lib/motion/gsap";

import { diveDepth, fractionalStationHeld, stationLayout } from "./exhibits/dive";
import type { SceneEngine } from "./scene/Engine";

export function useScrollFlight(
  engineRef: RefObject<SceneEngine | null>,
  enabled: boolean,
  /** Changes whenever the rendered sections change (so the route is rebuilt). */
  signature: string,
  failed: boolean,
  onStation: (index: number, key: string) => void,
) {
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || failed) return;
    if (!enabled) {
      engine.setStations(["ambient"]);
      engine.setProgress(0);
      return;
    }

    let els: HTMLElement[] = [];
    let keys: string[] = [];
    let keysSig = "";
    let levels: number[] = [];
    let anchors: number[] = [];
    let holds: number[] = [];
    const measure = () => {
      // Re-query every time: sections mount (and the owner reorders them) after first paint.
      els = Array.from(document.querySelectorAll<HTMLElement>("[data-station]"));
      keys = els.map((el) => el.dataset.station ?? "ambient");
      if (keys.join() !== keysSig) {
        keysSig = keys.join();
        engine.setStations(keys);
      }
      levels = els.map((el) => Number(el.dataset.diveLevels) || 0);
      ({ anchors, holds } = stationLayout(
        els.map((el) => el.getBoundingClientRect()),
        levels,
        window.scrollY,
        window.innerHeight,
      ));
    };
    const update = () => {
      const y = window.scrollY;
      const f = fractionalStationHeld(y, anchors, holds);
      engine.setProgress(f);
      const depths: Record<string, number> = {};
      levels.forEach((n, i) => {
        if (n > 0) depths[keys[i]] = diveDepth(y, anchors[i], holds[i], n);
      });
      engine.setDepths(depths);
      const nearest = Math.min(keys.length - 1, Math.max(0, Math.round(f)));
      onStation(nearest, keys[nearest] ?? "");
    };
    measure();
    update();

    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: update,
      onRefresh: () => {
        measure();
        update();
      },
    });
    // Images, fonts and lazy content move sections after first paint.
    const ro = new ResizeObserver(() => {
      measure();
      update();
    });
    ro.observe(document.body);

    return () => {
      trigger.kill();
      ro.disconnect();
    };
  }, [engineRef, enabled, signature, failed, onStation]);
}
