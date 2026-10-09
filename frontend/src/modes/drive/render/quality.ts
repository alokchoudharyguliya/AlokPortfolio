/**
 * Rendering budgets for Drive, keyed off the same device tiers as 3D mode
 * (lib/device.qualityTier). The scene never assumes a strong GPU.
 */
import type { QualityTier } from "@/lib/device";

export interface DriveQuality {
  tier: Exclude<QualityTier, "none">;
  maxDpr: number;
  antialias: boolean;
  /** Scales the number of trees. */
  treeDensity: number;
  /** Distant mountains. */
  mountains: number;
  /** Traffic cars drawn at once. */
  maxCars: number;
  /** Multiplies the fog distance (how far the world is drawn). */
  view: number;
  stars: boolean;
}

const TIERS: Record<Exclude<QualityTier, "none">, DriveQuality> = {
  high: { tier: "high", maxDpr: 2, antialias: true, treeDensity: 1, mountains: 140, maxCars: 10, view: 1, stars: true },
  medium: { tier: "medium", maxDpr: 1.5, antialias: true, treeDensity: 0.6, mountains: 80, maxCars: 8, view: 0.8, stars: true },
  low: { tier: "low", maxDpr: 1, antialias: false, treeDensity: 0.3, mountains: 30, maxCars: 5, view: 0.6, stars: false },
};

export function driveQuality(tier: QualityTier): DriveQuality | null {
  return tier === "none" ? null : TIERS[tier];
}
