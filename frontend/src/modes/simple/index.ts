/**
 * Simple mode — clean editorial layout with the profiler-trace hero.
 * Loaded lazily via modes/registry.ts.
 */
import type { ModeViews } from "../types";
import SimpleLayout from "./SimpleLayout";
import { BlogIndexView, HomeView, NotFoundView, PostView, ProjectView } from "./views";

const views: ModeViews = {
  Layout: SimpleLayout,
  Home: HomeView,
  Project: ProjectView,
  BlogIndex: BlogIndexView,
  Post: PostView,
  NotFound: NotFoundView,
};

export default views;
