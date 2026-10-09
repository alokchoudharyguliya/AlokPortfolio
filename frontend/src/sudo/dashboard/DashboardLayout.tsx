/**
 * Dashboard shell: auth guard, sidebar navigation (a slide-over menu on
 * phones), and the routed page outlet. Pages are listed once in NAV and
 * routed in DashboardRoutes so the menu and the routes can't drift apart.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";

import { useUnreadCount } from "@/api/admin";
import { useLogout, useMe } from "@/api/auth";
import { qk } from "@/api/queryKeys";
import { BootScreen } from "@/app/BootScreen";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import type { IconName } from "@/ui/Icon";
import { ThemeToggle } from "@/ui/ThemeToggle";

import styles from "./Dashboard.module.css";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "", items: [{ to: "/sudo", label: "Overview", icon: "home" }] },
  {
    group: "Content",
    items: [
      { to: "/sudo/profile", label: "Profile", icon: "user" },
      { to: "/sudo/experience", label: "Experience", icon: "briefcase" },
      { to: "/sudo/projects", label: "Projects", icon: "folder" },
      { to: "/sudo/skills", label: "Skills", icon: "wrench" },
      { to: "/sudo/focus-areas", label: "Focus areas", icon: "cpu" },
      { to: "/sudo/education", label: "Education", icon: "book" },
      { to: "/sudo/achievements", label: "Achievements", icon: "award" },
      { to: "/sudo/posts", label: "Writing", icon: "file" },
      { to: "/sudo/social-links", label: "Links", icon: "globe" },
      { to: "/sudo/resumes", label: "Resumes", icon: "download" },
    ],
  },
  {
    group: "Site",
    items: [
      { to: "/sudo/sections", label: "Sections", icon: "layers" },
      { to: "/sudo/settings", label: "Settings", icon: "settings" },
      { to: "/sudo/media", label: "Media", icon: "image" },
    ],
  },
  {
    group: "Visitors",
    items: [
      { to: "/sudo/inbox", label: "Inbox", icon: "inbox" },
      { to: "/sudo/analytics", label: "Analytics", icon: "chart" },
      { to: "/sudo/games", label: "Games", icon: "gamepad" },
    ],
  },
  {
    group: "Account",
    items: [
      { to: "/sudo/history", label: "History", icon: "history" },
      { to: "/sudo/security", label: "Security", icon: "shield" },
    ],
  },
];

export function DashboardLayout() {
  const me = useMe();
  const location = useLocation();
  const qc = useQueryClient();
  const logout = useLogout();
  const unread = useUnreadCount(me.data?.authenticated === true);
  // The menu is open only for the page it was opened on, so navigating closes it.
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null);
  const menuOpen = menuOpenAt === location.pathname;
  const setMenuOpen = (open: boolean) => setMenuOpenAt(open ? location.pathname : null);

  // A failed token refresh anywhere means the session is gone: re-check identity.
  useEffect(() => {
    const onExpired = () => qc.invalidateQueries({ queryKey: qk.me });
    window.addEventListener("sudo:session-expired", onExpired);
    return () => window.removeEventListener("sudo:session-expired", onExpired);
  }, [qc]);

  useEffect(() => {
    document.title = "Sudo — dashboard";
  }, []);

  if (me.isLoading) return <BootScreen />;
  if (!me.data?.authenticated) {
    return <Navigate to={`/sudo/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} data-open={menuOpen}>
        <div className={styles.sidebarHead}>
          <span className={styles.prompt}>sudo@{me.data.user?.username}</span>
          <Button variant="ghost" iconOnly icon="close" aria-label="Close menu" className={styles.closeMenu}
            onClick={() => setMenuOpen(false)} />
        </div>
        <nav aria-label="Dashboard">
          {NAV.map((group) => (
            <div key={group.group || "root"} className={styles.navGroup}>
              {group.group ? <p className={styles.navGroupLabel}>{group.group}</p> : null}
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/sudo"} className={styles.navItem}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.to === "/sudo/inbox" && unread.data?.unread ? (
                    <span className={styles.badge}>{unread.data.unread}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <Link to="/" className={styles.navItem}>
            <Icon name="arrowLeft" />
            <span>View site</span>
          </Link>
          <button type="button" className={styles.navItem} onClick={() => logout.mutate()}>
            <Icon name="logout" />
            <span>Log out</span>
          </button>
        </div>
      </aside>
      {menuOpen ? <div className={styles.scrim} onClick={() => setMenuOpen(false)} aria-hidden /> : null}

      <div className={styles.content}>
        <header className={styles.topbar}>
          <Button variant="ghost" iconOnly icon="menu" aria-label="Open menu" className={styles.openMenu}
            onClick={() => setMenuOpen(true)} />
          <span className={styles.topbarSpacer} />
          <ThemeToggle />
        </header>
        <main className={styles.page}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
