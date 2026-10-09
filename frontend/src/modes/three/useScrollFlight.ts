/**
 * Connects page scroll to the camera. Every element marked `data-station` is
 * a stop on the flight; the owner's section order therefore decides the route.
 * On detail pages (project, post, 404) the camera rests on a calm wide shot.
 */
import { useEffect } from "react";
import type { RefObject } from "react";

import { ScrollTrigger } from "@/lib/motion/gsap";

import type { SceneEngine } from "./scene/Engine";
import { anchorsFromRects, fractionalStation } from "./scene/stations";

export function useScrollFlight(
  engineRef: RefObject<SceneEngine | null>,
  enabled: boolean,
  /** Changes whenever the rendered sections change (so the route is rebuilt). */
  signature: string,
  failed: boolean,
  onStation: (index: number) => void,
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
    let keysSig = "";
    let anchors: number[] = [];
    const measure = () => {
      // Re-query every time: sections mount (and the owner reorders them) after first paint.
      els = Array.from(document.querySelectorAll<HTMLElement>("[data-station]"));
      const keys = els.map((el) => el.dataset.station ?? "ambient");
      if (keys.join() !== keysSig) {
        keysSig = keys.join();
        engine.setStations(keys);
      }
      anchors = anchorsFromRects(
        els.map((el) => el.getBoundingClientRect()),
        window.scrollY,
        window.innerHeight,
      );
    };
    const update = () => {
      const f = fractionalStation(window.scrollY, anchors);
      engine.setProgress(f);
      onStation(Math.round(f));
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
