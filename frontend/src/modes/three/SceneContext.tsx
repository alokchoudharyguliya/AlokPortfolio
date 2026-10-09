/**
 * Lets section components talk to the 3D scene without importing three.js:
 * hovering a project card lights its tile on the die, hovering a skills tier
 * brightens its memory ring. Outside 3D mode (or when the scene failed to
 * start) every call is a no-op.
 */
import { createContext, useContext } from "react";

export interface SceneApi {
  highlightProject(index: number | null): void;
  highlightTier(index: number | null): void;
}

export const NOOP_SCENE: SceneApi = { highlightProject: () => {}, highlightTier: () => {} };

export const SceneContext = createContext<SceneApi>(NOOP_SCENE);

export const useScene = () => useContext(SceneContext);

/**
 * Whether exhibits can dive: the scene is running, the device is strong enough and motion is
 * allowed. When false, an exhibit renders as a plain list of its levels instead of a pinned zoom.
 */
export interface DiveState {
  live: boolean;
}

export const DiveContext = createContext<DiveState>({ live: false });

export const useDive = () => useContext(DiveContext);
