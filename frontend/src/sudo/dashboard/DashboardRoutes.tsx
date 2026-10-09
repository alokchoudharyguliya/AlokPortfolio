/** /sudo/* routes. Lazy-loaded so visitors never download dashboard code. */
import { Route, Routes } from "react-router-dom";

import { DashboardLayout } from "./DashboardLayout";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { GamesPage } from "./pages/GamesPage";
import { HistoryPage } from "./pages/HistoryPage";
import { InboxPage } from "./pages/InboxPage";
import { MediaPage } from "./pages/MediaPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ResourcePage } from "./pages/ResourcePage";
import { SecurityPage } from "./pages/SecurityPage";
import { SingletonPage } from "./pages/SingletonPage";
import { SkillsPage } from "./pages/SkillsPage";

/** Collection resources that use the generic page as-is. */
const SIMPLE_COLLECTIONS: { path: string; resource: string; intro?: string }[] = [
  { path: "experience", resource: "experience", intro: "Drag to set the order shown on the timeline." },
  { path: "projects", resource: "projects", intro: "Featured projects get the large layout on the home page." },
  { path: "focus-areas", resource: "focus-areas" },
  { path: "education", resource: "education" },
  { path: "achievements", resource: "achievements" },
  { path: "posts", resource: "posts", intro: "Posts stay drafts until you publish them." },
  { path: "social-links", resource: "social-links", intro: "Shown in the hero, contact section and footer." },
  { path: "resumes", resource: "resumes", intro: "Upload PDFs; the active one is offered for download." },
  { path: "sections", resource: "sections", intro: "Rename, hide or reorder home page sections. Every mode follows this order." },
];

export default function DashboardRoutes() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="profile" element={<SingletonPage resource="profile" intro="Your name, headline, career trace and about text." />} />
        <Route path="settings" element={<SingletonPage resource="site" intro="Defaults for new visitors, features and search appearance." />} />
        <Route path="skills" element={<SkillsPage />} />
        {SIMPLE_COLLECTIONS.map((c) => (
          <Route key={c.path} path={c.path} element={<ResourcePage resource={c.resource} intro={c.intro} />} />
        ))}
        <Route path="media" element={<MediaPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="games" element={<GamesPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="*" element={<OverviewPage />} />
      </Route>
    </Routes>
  );
}
