import { lazy, useMemo } from "react";

import type { ModeId } from "@/api/types";

import { MODES } from "./registry";
import type { LazyViews, ModeViews } from "./types";

const cache = new Map<ModeId, LazyViews>();

/**
 * Lazily-loaded view components for a mode. Each view is a React.lazy wrapper
 * over the mode's module, so switching modes downloads that skin on demand
 * and the module is fetched once per session.
 */
export function useModeViews(mode: ModeId): LazyViews {
  return useMemo(() => {
    const hit = cache.get(mode);
    if (hit) return hit;
    let modulePromise: Promise<{ default: ModeViews }> | null = null;
    const load = () => (modulePromise ??= MODES[mode].load());
    const pick = <K extends keyof ModeViews>(key: K) =>
      lazy(async () => ({ default: (await load()).default[key] }));
    const views = {
      Layout: pick("Layout"),
      Home: pick("Home"),
      Project: pick("Project"),
      BlogIndex: pick("BlogIndex"),
      Post: pick("Post"),
      NotFound: pick("NotFound"),
    } as LazyViews;
    cache.set(mode, views);
    return views;
  }, [mode]);
}
