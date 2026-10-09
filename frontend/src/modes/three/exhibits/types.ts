/**
 * What the engine needs from an exhibit. Everything three.js-specific about a
 * particular exhibit (geometry, animation, camera path) hides behind this.
 */
import type { Object3D } from "three";

import type { Palette } from "../scene/palette";
import type { Pose } from "../scene/stations";

export interface ExhibitFrame {
  /** Seconds (frozen under reduced motion). */
  time: number;
  /** 0 … levels−1: how far the viewer has descended. */
  depth: number;
  /** 0–1: how present the exhibit is (1 while the camera is parked on its station). */
  weight: number;
  reduced: boolean;
  /** Viewport width ÷ height, so framing can clear the caption panel (left on wide screens, bottom on tall ones). */
  aspect: number;
}

export interface Exhibit {
  readonly root: Object3D;
  setPalette(palette: Palette): void;
  /** Fade parts, run animation, and leave world matrices current for `poseAt`. */
  update(frame: ExhibitFrame): void;
  /** Camera pose in world space at depth `d` (call after `update`). */
  poseAt(depth: number): Pose;
}

export type ExhibitFactory = () => Exhibit;
