/** Small building blocks shared by Simple-mode sections and views. */
import type { ReactNode } from "react";

import type { Section, SocialLink } from "@/api/types";
import { track } from "@/lib/analytics";
import { EditableSection } from "@/sudo/inline/Editable";
import { Icon } from "@/ui/Icon";
import type { IconName } from "@/ui/Icon";

import styles from "./Sections.module.css";

const PLATFORM_ICON: Record<string, IconName> = {
  github: "github",
  linkedin: "linkedin",
  x: "xLogo",
  email: "mail",
  website: "globe",
};

export function SocialLinks({ links, withLabels = false }: { links: SocialLink[]; withLabels?: boolean }) {
  if (!links.length) return null;
  return (
    <ul className={styles.socials}>
      {links.map((l) => (
        <li key={l.id}>
          <a
            href={l.url}
            className={styles.social}
            target={l.url.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer noopener"
            aria-label={withLabels ? undefined : l.label}
            onClick={() => track("outbound_click", { platform: l.platform })}
          >
            <Icon name={PLATFORM_ICON[l.platform] ?? "external"} />
            {withLabels ? <span>{l.label}</span> : null}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function TagList({ tags, label = "Technologies" }: { tags: string[]; label?: string }) {
  if (!tags.length) return null;
  return (
    <ul className={styles.tags} aria-label={label}>
      {tags.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/**
 * Standard section frame: heading column (sticky on wide screens) + content.
 * Wrapped in EditableSection so the owner gets section tools in edit mode.
 */
export function SectionFrame({
  meta,
  children,
  wide = false,
}: {
  meta: Section;
  children: ReactNode;
  /** Let the content use the full width under the heading. */
  wide?: boolean;
}) {
  const headingId = `${meta.key}-title`;
  return (
    <EditableSection meta={meta}>
      <section id={meta.key} className={wide ? styles.sectionWide : styles.section} aria-labelledby={headingId}>
        <header className={styles.sectionHead}>
          <h2 id={headingId} className={styles.sectionTitle}>
            {meta.title}
          </h2>
          {meta.subtitle ? <p className={styles.sectionSubtitle}>{meta.subtitle}</p> : null}
        </header>
        <div className={styles.sectionBody}>{children}</div>
      </section>
    </EditableSection>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
