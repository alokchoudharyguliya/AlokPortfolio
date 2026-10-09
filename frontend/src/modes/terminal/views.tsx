/**
 * Terminal route views.
 *
 * The Terminal is one persistent screen (TerminalLayout), so these views
 * render nothing. They exist so deep links still work: opening
 * /projects/<slug> or /blog/<slug> makes the shell run the equivalent
 * `cat …` once, as if the visitor had typed it.
 *
 * Navigation that the shell itself triggered (a `cat` of a project updates the
 * URL) is tagged `state.fromShell` and skipped, so output is never doubled.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import type { Bootstrap } from "@/api/types";

import { useShell } from "./shell/context";
import { absPath } from "./shell/render";

function useRouteCommand(line: string | null) {
  const { run } = useShell();
  const location = useLocation();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    // StrictMode re-runs effects with the same refs; the key makes this idempotent.
    if (!line || handled.current === location.key) return;
    handled.current = location.key;
    if ((location.state as { fromShell?: boolean } | null)?.fromShell) return;
    run(line);
  }, [line, location.key, location.state, run]);
}

export function HomeView(_props: { bootstrap: Bootstrap }) {
  return null;
}

export function ProjectView({ slug }: { bootstrap: Bootstrap; slug: string }) {
  useRouteCommand(`cat ${absPath(["projects", slug])}`);
  return null;
}

export function BlogIndexView(_props: { bootstrap: Bootstrap }) {
  useRouteCommand(`cat ${absPath(["blog"])}`);
  return null;
}

export function PostView({ slug }: { bootstrap: Bootstrap; slug: string }) {
  useRouteCommand(`cat ${absPath(["blog", slug])}`);
  return null;
}

export function NotFoundView(_props: { bootstrap: Bootstrap }) {
  const { pathname } = useLocation();
  // `cat` of a path that doesn't exist yields the standard "no such file" message.
  useRouteCommand(`cat ${JSON.stringify(pathname)}`);
  return null;
}
