/**
 * Device capability detection shared by analytics, the mode switcher and the
 * (upcoming) 3D mode's auto-degrade logic.
 */

export type DeviceClass = "mobile" | "tablet" | "desktop";

export function deviceClass(): DeviceClass {
  const w = Math.min(window.innerWidth, window.screen?.width ?? window.innerWidth);
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (w < 640) return "mobile";
  if (w < 1024 && coarse) return "tablet";
  return "desktop";
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let webglCache: boolean | null = null;

/** Whether a WebGL context can be created at all (3D mode prerequisite). */
export function supportsWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement("canvas");
    webglCache = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

export type QualityTier = "high" | "medium" | "low" | "none";

/**
 * Rough rendering budget for 3D mode: no WebGL → "none" (fallback to Simple);
 * reduced motion, Save-Data, low memory or few cores → "low"; small screens → "medium".
 */
export function qualityTier(): QualityTier {
  if (!supportsWebGL()) return "none";
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (
    prefersReducedMotion() ||
    nav.connection?.saveData ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2)
  ) {
    return "low";
  }
  return deviceClass() === "desktop" ? "high" : "medium";
}
