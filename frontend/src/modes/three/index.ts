/**
 * 3D mode — a scroll-driven flight into a procedural GPU die (three.js),
 * with the page's content in glass panels above it. Loaded lazily via
 * modes/registry.ts, so three.js is only downloaded when this mode is used.
 *
 *   index.ts           ModeViews wiring (this file)
 *   ThreeLayout.tsx    chrome, canvas, HUD (call-stack rail, readout), scroll + scene wiring
 *   views.tsx          route views (home stations, detail panels)
 *   sections.tsx       station presenters (hero, experience, projects, skills)
 *   scene/             the three.js engine, shaders, camera stations, palette, quality tiers
 */
import type { ModeViews } from "../types";
import ThreeLayout from "./ThreeLayout";
import { BlogIndexView, HomeView, NotFoundView, PostView, ProjectView } from "./views";

const views: ModeViews = {
  Layout: ThreeLayout,
  Home: HomeView,
  Project: ProjectView,
  BlogIndex: BlogIndexView,
  Post: PostView,
  NotFound: NotFoundView,
};

export default views;
