/**
 * Terminal mode — the portfolio as an interactive shell (`ls projects`,
 * `cat about`, tappable chips). Loaded lazily via modes/registry.ts.
 *
 *   index.ts            ModeViews wiring (this file)
 *   TerminalLayout.tsx  window chrome + command line input
 *   views.tsx           route views (deep links → run a command)
 *   commands/           the command set (navigation, general, owner)
 *   shell/              parser, virtual filesystem, completion, state machine
 */
import type { ModeViews } from "../types";
import TerminalLayout from "./TerminalLayout";
import { BlogIndexView, HomeView, NotFoundView, PostView, ProjectView } from "./views";

const views: ModeViews = {
  Layout: TerminalLayout,
  Home: HomeView,
  Project: ProjectView,
  BlogIndex: BlogIndexView,
  Post: PostView,
  NotFound: NotFoundView,
};

export default views;
