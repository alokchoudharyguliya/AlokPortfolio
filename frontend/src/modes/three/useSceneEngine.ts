/**
 * Owns the SceneEngine's lifecycle:
 *   create canvas (WebGL + quality tier) → size/pointer/theme wiring → power-on intro → dispose.
 *
 * The <canvas> is created here rather than rendered by React: disposing an
 * engine force-loses its WebGL context, and a context-lost canvas can never
 * give out a new context. React StrictMode (dev) and remounts re-run this
 * effect, so each run gets its own fresh element.
 *
 * It never throws. If WebGL is missing, the context is lost or the engine
 * can't start, `failed` becomes true and the layout keeps working as a
 * content-only page.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { qualityTier } from "@/lib/device";
import { gsap } from "@/lib/motion/gsap";

import { readPalette } from "./scene/palette";
import { qualitySettings } from "./scene/quality";
import { SceneEngine } from "./scene/Engine";
import type { EngineContent } from "./scene/Engine";

/** Clicks on these don't ripple the die (they're UI, not the scene). */
const INTERACTIVE = "a, button, input, textarea, select, label, summary, [role='button'], [data-no-pulse]";

export function useSceneEngine(hostRef: RefObject<HTMLElement | null>, content: EngineContent, reducedMotion: boolean) {
  const engineRef = useRef<SceneEngine | null>(null);
  const [failed, setFailed] = useState(() => qualitySettings(qualityTier()) === null);
  const contentRef = useRef(content);
  const markFailed = useCallback(() => setFailed(true), []);

  useEffect(() => {
    contentRef.current = content;
    engineRef.current?.setContent(content);
  }, [content]);

  useEffect(() => {
    const host = hostRef.current;
    const quality = qualitySettings(qualityTier());
    if (!host || !quality) return;

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(canvas);

    let engine: SceneEngine;
    try {
      engine = new SceneEngine(canvas, {
        quality,
        reducedMotion,
        palette: readPalette(),
        onContextLost: markFailed,
      });
    } catch {
      // No usable WebGL context (blocked, exhausted, or a headless browser).
      canvas.remove();
      queueMicrotask(markFailed);
      return;
    }
    engineRef.current = engine;
    engine.setContent(contentRef.current);

    const size = () => engine.resize(canvas.clientWidth, canvas.clientHeight);
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    // Theme / accent changes rewrite attributes on <html>; re-read the tokens when they do.
    const mo = new MutationObserver(() => engine.setPalette(readPalette()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });

    const onMove = (e: PointerEvent) => engine.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    const onLeave = () => engine.setPointer(null);
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      engine.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
      engine.pulse();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    // Power-on: the die draws outward from the centre while the camera dollies in.
    const boot = { v: reducedMotion ? 1 : 0 };
    engine.setReveal(boot.v);
    const intro = reducedMotion
      ? null
      : gsap.to(boot, { v: 1, duration: 3, ease: "power2.inOut", delay: 0.15, onUpdate: () => engine.setReveal(boot.v) });

    engine.start();

    return () => {
      intro?.kill();
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      engine.dispose();
      canvas.remove();
      engineRef.current = null;
    };
  }, [hostRef, reducedMotion, markFailed]);

  return { engineRef, failed };
}
