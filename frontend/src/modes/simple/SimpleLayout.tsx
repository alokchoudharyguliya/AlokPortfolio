/**
 * Simple mode chrome: sticky header (section nav + mode/theme switches),
 * a scroll "playhead" (reading progress drawn like a profiler cursor),
 * and the footer. Lenis smooth scrolling is enabled only in this mode.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import type { Bootstrap } from "@/api/types";
import { buildSections } from "@/domain/sections";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { SmoothScroll } from "@/lib/motion/SmoothScroll";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";
import { Icon } from "@/ui/Icon";
import { ModeSwitcher } from "@/ui/ModeSwitcher";
import { ThemeToggle } from "@/ui/ThemeToggle";

import { SocialLinks } from "./parts";
import styles from "./SimpleLayout.module.css";

const NAV_SECTIONS = new Set(["about", "experience", "projects", "skills", "blog", "contact"]);

export default function SimpleLayout({ bootstrap, children }: { bootstrap: Bootstrap; children: ReactNode }) {
  const location = useLocation();
  // The menu is open only for the URL it was opened on, so navigating closes it.
  const here = location.pathname + location.hash;
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null);
  const menuOpen = menuOpenAt === here;
  const setMenuOpen = (open: boolean) => setMenuOpenAt(open ? here : null);
  const onHome = location.pathname === "/";
  const nav = buildSections(bootstrap).filter((s) => NAV_SECTIONS.has(s.key) && !s.isEmpty);
  const initials = bootstrap.profile.full_name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  // Scroll to top on route change (Lenis-safe), except for in-page hashes.
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0 });
  }, [location.pathname, location.hash]);

  return (
    <div className={styles.shell}>
      <SmoothScroll />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Playhead />
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label={`${bootstrap.profile.full_name}, home`}>
            <span className={styles.monogram} aria-hidden>
              {initials}
            </span>
            <span className={styles.brandName}>{bootstrap.profile.full_name}</span>
          </Link>

          <nav className={styles.nav} data-open={menuOpen} aria-label="Sections">
            {nav.map((s) => (
              <a key={s.key} href={onHome ? `#${s.key}` : `/#${s.key}`} className={styles.navLink}>
                {s.meta.title}
              </a>
            ))}
          </nav>

          <div className={styles.controls}>
            <div className={styles.modeWide}>
              <ModeSwitcher />
            </div>
            <div className={styles.modeCompact}>
              <ModeSwitcher compact />
            </div>
            <ThemeToggle />
            <button
              type="button"
              className={styles.menuButton}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>

      <main id="main" className={styles.main}>
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>
            © {new Date().getFullYear()} {bootstrap.profile.full_name}
            {bootstrap.site.footer_note ? ` — ${bootstrap.site.footer_note}` : ""}
          </p>
          <SocialLinks links={bootstrap.social_links} />
        </div>
      </footer>
    </div>
  );
}

/**
 * Reading progress drawn as a trace playhead: a thin line under the header
 * whose width follows scroll position (GSAP ScrollTrigger, scrubbed).
 */
function Playhead() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const location = useLocation();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: reduced ? true : 0.3 },
      },
    );
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => {
      window.clearTimeout(refresh);
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [reduced, location.pathname]);

  return <div ref={ref} className={styles.playhead} aria-hidden />;
}
