/**
 * Panel entrance: fade and rise as a glass panel scrolls into view (GSAP
 * ScrollTrigger, once). Skipped under reduced motion, and the inline styles
 * are cleaned up on unmount so a re-mounted panel never starts hidden.
 */
import { useEffect } from "react";
import type { RefObject } from "react";

import { gsap } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";

export function useReveal(ref: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 44 },
      { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(el, { clearProps: "opacity,transform" });
    };
  }, [ref, reduced]);
}
