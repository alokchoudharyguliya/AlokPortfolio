/**
 * PublicSite — the viewer-facing app shell, independent of presentation mode.
 *
 *   bootstrap (API) ──► buildSections ──► active mode's views (lazy) ──► DOM
 *                         ▲
 *     owner "edit page" ──┘ (requests drafts so hidden items can be edited)
 *
 * Responsibilities: load the bootstrap aggregate, apply the owner's site
 * defaults (mode/theme/accent), keep analytics in sync, route public URLs to
 * the active mode's views, and keep the document title meaningful.
 */
import { Suspense, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { Route, Routes, useLocation, useParams } from "react-router-dom";

import { useBootstrap } from "@/api/public";
import type { Bootstrap } from "@/api/types";
import { buildSections } from "@/domain/sections";
import { setAnalyticsEnabled, track } from "@/lib/analytics";
import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import type { LazyViews } from "@/modes/types";
import { useModeViews } from "@/modes/useModeViews";
import { SudoBar } from "@/sudo/SudoBar";
import { useSudo } from "@/sudo/SudoProvider";

import { BootScreen } from "./BootScreen";

export function PublicSite() {
  const { editing, isOwner } = useSudo();
  const boot = useBootstrap(editing);
  const { mode, applySiteDefaults } = usePreferences();
  const views = useModeViews(mode);
  const data = boot.data;

  useEffect(() => {
    if (data) applySiteDefaults(data.site);
  }, [data, applySiteDefaults]);

  useEffect(() => {
    setAnalyticsEnabled(Boolean(data?.site.analytics_enabled) && !isOwner);
  }, [data?.site.analytics_enabled, isOwner]);

  usePageviews(Boolean(data));

  if (!data) {
    return <BootScreen error={boot.isError} onRetry={() => boot.refetch()} />;
  }

  return (
    <Suspense fallback={<BootScreen />}>
      <views.Layout bootstrap={data}>
        <PublicRoutes views={views} bootstrap={data} editing={editing} />
      </views.Layout>
      <SudoBar />
    </Suspense>
  );
}

function PublicRoutes({ views, bootstrap, editing }: { views: LazyViews; bootstrap: Bootstrap; editing: boolean }) {
  const sections = useMemo(
    () => buildSections(bootstrap).filter((s) => editing || !s.isEmpty),
    [bootstrap, editing],
  );
  const site = bootstrap.site;

  return (
    <Routes>
      <Route index element={<Titled title={site.site_title}><views.Home bootstrap={bootstrap} sections={sections} /></Titled>} />
      <Route path="projects/:slug" element={<ProjectRoute views={views} bootstrap={bootstrap} />} />
      {site.blog_enabled || editing ? (
        <>
          <Route path="blog" element={<Titled title={`Writing — ${bootstrap.profile.full_name}`}><views.BlogIndex bootstrap={bootstrap} /></Titled>} />
          <Route path="blog/:slug" element={<PostRoute views={views} bootstrap={bootstrap} />} />
        </>
      ) : null}
      <Route path="*" element={<Titled title="Not found"><views.NotFound bootstrap={bootstrap} /></Titled>} />
    </Routes>
  );
}

function ProjectRoute({ views, bootstrap }: { views: LazyViews; bootstrap: Bootstrap }) {
  const { slug = "" } = useParams();
  const project = bootstrap.projects.find((p) => p.slug === slug);
  return (
    <Titled title={project ? `${project.title} — ${bootstrap.profile.full_name}` : "Not found"}>
      {project ? <views.Project bootstrap={bootstrap} slug={slug} /> : <views.NotFound bootstrap={bootstrap} />}
    </Titled>
  );
}

function PostRoute({ views, bootstrap }: { views: LazyViews; bootstrap: Bootstrap }) {
  const { slug = "" } = useParams();
  return <views.Post bootstrap={bootstrap} slug={slug} />;
}

function Titled({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return <>{children}</>;
}

/** One pageview per route change (no-op when analytics is disabled). */
function usePageviews(ready: boolean) {
  const location = useLocation();
  useEffect(() => {
    if (ready) track("pageview");
  }, [ready, location.pathname]);
}
