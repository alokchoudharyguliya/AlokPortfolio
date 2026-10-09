/**
 * Drive mode — the portfolio as a first-person drive. Loaded lazily via
 * modes/registry.ts, so three.js and the car models are only downloaded when
 * a visitor opens this mode.
 *
 *   index.ts            ModeViews wiring (this file)
 *   DriveLayout.tsx     orchestration: stage, HUD, panels, menu, keyboard
 *   useDrive.ts         game + renderer + loop + input devices
 *   engine/             pure game logic: route, car physics, traffic, autopilot, input mapping (unit-tested)
 *   render/             three.js world: road, terrain, scenery, gates, sky, day/night
 *   Cockpit.tsx         the car interior (SVG + CSS, animated by CSS variables)
 *   CheckpointPanel.tsx the section content at each gate (reuses Simple's section components)
 */
import type { ModeViews } from "../types";
import DriveLayout from "./DriveLayout";
import { BlogIndexView, HomeView, NotFoundView, PostView, ProjectView } from "./views";

const views: ModeViews = {
  Layout: DriveLayout,
  Home: HomeView,
  Project: ProjectView,
  BlogIndex: BlogIndexView,
  Post: PostView,
  NotFound: NotFoundView,
};

export default views;
