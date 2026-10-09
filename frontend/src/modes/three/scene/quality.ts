/**
 * Rendering budgets per device tier (lib/device.qualityTier). The scene never
 * assumes a strong GPU: tiers cap particle count, pixel ratio and effects, and
 * the engine can step down further at runtime if frames run long.
 */
import type { QualityTier } from "@/lib/device";

export interface QualitySettings {
  tier: Exclude<QualityTier, "none">;
  /** Tiles per side of the die. */
  grid: number;
  particles: number;
  maxDpr: number;
  antialias: boolean;
  /** Pointer ripples and parallax. */
  pointerFx: boolean;
}

const TIERS: Record<Exclude<QualityTier, "none">, QualitySettings> = {
  high: { tier: "high", grid: 10, particles: 42_000, maxDpr: 2, antialias: true, pointerFx: true },
  medium: { tier: "medium", grid: 8, particles: 16_000, maxDpr: 1.5, antialias: true, pointerFx: true },
  low: { tier: "low", grid: 6, particles: 5_000, maxDpr: 1, antialias: false, pointerFx: false },
};

/** Settings for a tier, or null when 3D cannot run at all (no WebGL). */
export function qualitySettings(tier: QualityTier): QualitySettings | null {
  return tier === "none" ? null : TIERS[tier];
}

/** Pixel ratios the adaptive loop steps down through, highest first. */
export const DPR_STEPS = [2, 1.5, 1.25, 1, 0.75] as const;

/** The next lower pixel ratio below `current`, or null at the floor. */
export function lowerDpr(current: number): number | null {
  const lower = DPR_STEPS.find((s) => s < current - 0.01);
  return lower ?? null;
}

/**
 * Decide whether to degrade given recent frame times (ms). Triggers when the
 * average exceeds `budgetMs` over at least `minFrames` samples.
 */
export function shouldDegrade(frameTimes: number[], budgetMs = 26, minFrames = 60): boolean {
  if (frameTimes.length < minFrames) return false;
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  return avg > budgetMs;
}
