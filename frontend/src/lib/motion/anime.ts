/**
 * anime.js presets for *responsive* motion — feedback to something the visitor
 * just did (toggle, copy, send). Scroll/timeline choreography uses GSAP; these
 * small, interruptible tweens use anime.js. All presets no-op under reduced motion.
 */
import { animate, stagger } from "animejs";

import { prefersReducedMotion } from "@/lib/device";

/** A quick squash-and-settle on the element that was pressed. */
export function pressFeedback(el: Element | null) {
  if (!el || prefersReducedMotion()) return;
  animate(el, { scale: [0.92, 1], duration: 420, ease: "outElastic(1, .6)" });
}

/** Spin + fade an icon swap (theme toggle sun ↔ moon). */
export function swapIcon(el: Element | null) {
  if (!el || prefersReducedMotion()) return;
  animate(el, { rotate: [-90, 0], opacity: [0, 1], duration: 450, ease: "outBack" });
}

/** Ripple a row of children (e.g. success checkmarks, chips). */
export function rippleChildren(container: Element | null) {
  if (!container || prefersReducedMotion()) return;
  animate(container.children, {
    translateY: [6, 0],
    opacity: [0, 1],
    delay: stagger(40),
    duration: 380,
    ease: "outQuad",
  });
}

/** Horizontal shake used for rejected input (wrong OTP, invalid form). */
export function shake(el: Element | null) {
  if (!el || prefersReducedMotion()) return;
  animate(el, { translateX: [0, -8, 8, -5, 5, 0], duration: 420, ease: "inOutSine" });
}
