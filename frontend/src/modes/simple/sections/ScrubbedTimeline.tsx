/**
 * Vertical timeline whose spine "draws" as the reader scrolls through it
 * (GSAP ScrollTrigger, scrubbed — the motion is driven by the reader's own
 * scrolling, and shows how far through the sequence they are).
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { gsap } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";

import styles from "../Sections.module.css";

export function ScrubbedTimeline({ children }: { children: ReactNode }) {
  const listRef = useRef<HTMLOListElement>(null);
  const spineRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !listRef.current || !spineRef.current) return;
    const tween = gsap.fromTo(
      spineRef.current,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: listRef.current,
          start: "top 75%",
          end: "bottom 60%",
          scrub: 0.4,
        },
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [reduced]);

  return (
    <div className={styles.timeline}>
      <span className={styles.spineTrack} aria-hidden>
        <span ref={spineRef} className={styles.spine} />
      </span>
      <ol ref={listRef} className={styles.timelineList}>
        {children}
      </ol>
    </div>
  );
}
