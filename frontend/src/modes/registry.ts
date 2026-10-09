/**
 * Mode registry — the ONLY place that knows which presentation modes exist.
 *
 * Adding a mode = create `modes/<id>/index.ts` exporting `ModeViews`, then add
 * one entry here. Routing, the switcher, preferences and analytics pick it up
 * automatically.
 */
import type { ModeId } from "@/api/types";
import { supportsWebGL } from "@/lib/device";

import type { ModeDefinition } from "./types";

export const MODES: Record<ModeId, ModeDefinition> = {
  simple: {
    id: "simple",
    label: "Simple",
    description: "Clean, readable layout",
    icon: "layout",
    implemented: true,
    load: () => import("./simple"),
  },
  terminal: {
    id: "terminal",
    label: "Terminal",
    description: "Explore with shell commands",
    icon: "terminal",
    implemented: true,
    load: () => import("./terminal"),
  },
  "3d": {
    id: "3d",
    label: "3D",
    description: "Interactive GPU-themed scenes",
    icon: "cube",
    implemented: true,
    isSupported: supportsWebGL,
    load: () => import("./three"),
  },
  drive: {
    id: "drive",
    label: "Drive",
    description: "Drive through the portfolio",
    icon: "car",
    implemented: true,
    isSupported: supportsWebGL,
    load: () => import("./drive"),
  },
};

export const MODE_ORDER: ModeId[] = ["simple", "terminal", "3d", "drive"];

export function isModeAvailable(id: ModeId): boolean {
  const mode = MODES[id];
  return Boolean(mode?.implemented && (mode.isSupported?.() ?? true));
}
