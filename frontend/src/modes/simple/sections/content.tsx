/**
 * Simple-mode renderings of the content sections. Each component receives the
 * shared SectionModel (domain/sections.ts) and wraps items in EditableItem so
 * inline editing works without any mode-specific editing code.
 */
import { Link } from "react-router-dom";

import { dateRange, fullDate, humanize, monthYear } from "@/domain/format";
import type { SectionProps } from "@/modes/types";
import { EditableItem } from "@/sudo/inline/Editable";
import { useSudo } from "@/sudo/SudoProvider";
import { Icon, isIconName } from "@/ui/Icon";
import { Markdown } from "@/ui/Markdown";

import { EmptyNote, SectionFrame, TagList } from "../parts";
import { ScrubbedTimeline } from "./ScrubbedTimeline";
import styles from "../Sections.module.css";

export function AboutSection({ model }: SectionProps<"about">) {
  const { profile } = model.data;
  return (
    <SectionFrame meta={model.meta}>
      {profile.about ? <Markdown className={styles.lead}>{profile.about}</Markdown> : null}
      {profile.philosophy ? (
        <div className={styles.philosophy}>
          <h3 className={styles.subhead}>How I work</h3>
          <Markdown>{profile.philosophy}</Markdown>
        </div>
      ) : null}
    </SectionFrame>
  );
}

export function FocusSection({ model }: SectionProps<"focus">) {
  return (
    <SectionFrame meta={model.meta}>
      <ul className={styles.focusGrid}>
        {model.data.areas.map((area, i) => (
          <EditableItem key={area.id} as="li" resource="focus-areas" item={area} className={styles.focus}>
            <span className={styles.focusRule} style={{ background: `var(--flame-${(i % 4) + 1})` }} aria-hidden />
            <h3 className={styles.itemTitle}>
              {isIconName(area.icon) ? <Icon name={area.icon} /> : null}
              {area.title}
            </h3>
            {area.description ? <p className={styles.muted}>{area.description}</p> : null}
            {area.items.length ? (
              <ul className={styles.plainList}>
                {area.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            ) : null}
          </EditableItem>
        ))}
      </ul>
    </SectionFrame>
  );
}

export function ExperienceSection({ model }: SectionProps<"experience">) {
  return (
    <SectionFrame meta={model.meta}>
      <ScrubbedTimeline>
        {model.data.items.map((exp) => (
          <EditableItem key={exp.id} as="li" resource="experience" item={exp} className={styles.timelineItem}>
            {exp.start_date || exp.end_date ? (
              <p className={styles.when}>{dateRange(exp.start_date, exp.end_date)}</p>
            ) : null}
            <h3 className={styles.itemTitle}>{exp.role}</h3>
            <p className={styles.org}>
              {exp.organization_url ? (
                <a href={exp.organization_url} target="_blank" rel="noreferrer noopener">
                  {exp.organization}
                </a>
              ) : (
                exp.organization
              )}
              <span className={styles.dot} aria-hidden />
              {humanize(exp.employment_type)}
              {exp.location ? `, ${exp.location}` : ""}
            </p>
            {exp.summary ? <p className={styles.body}>{exp.summary}</p> : null}
            {exp.highlights.length ? (
              <ul className={styles.bullets}>
                {exp.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : null}
            <TagList tags={exp.tags} />
          </EditableItem>
        ))}
      </ScrubbedTimeline>
    </SectionFrame>
  );
}

export function ProjectsSection({ model }: SectionProps<"projects">) {
  const featured = model.data.items.filter((p) => p.is_featured);
  const rest = model.data.items.filter((p) => !p.is_featured);
  return (
    <SectionFrame meta={model.meta}>
      <ol className={styles.featured}>
        {featured.map((p) => (
          <EditableItem key={p.id} as="li" resource="projects" item={p} className={styles.project}>
            <div className={styles.projectHead}>
              <h3 className={styles.projectTitle}>
                <Link to={`/projects/${p.slug}`}>{p.title}</Link>
              </h3>
              <span className={styles.status} data-status={p.status}>
                {humanize(p.status)}
              </span>
            </div>
            {p.summary ? <p className={styles.body}>{p.summary}</p> : null}
            {p.metrics.length ? (
              <dl className={styles.metrics}>
                {p.metrics.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>{m.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {p.highlights.length ? (
              <ul className={styles.bullets}>
                {p.highlights.slice(0, 4).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : null}
            <div className={styles.projectFoot}>
              <TagList tags={p.tags} />
              <ProjectLinks slug={p.slug} repo={p.repo_url} demo={p.demo_url} />
            </div>
          </EditableItem>
        ))}
      </ol>
      {rest.length ? (
        <>
          <h3 className={styles.subhead}>More projects</h3>
          <ul className={styles.compactList}>
            {rest.map((p) => (
              <EditableItem key={p.id} as="li" resource="projects" item={p} className={styles.compactRow}>
                <Link to={`/projects/${p.slug}`} className={styles.compactTitle}>
                  {p.title}
                </Link>
                <span className={styles.muted}>{p.summary}</span>
              </EditableItem>
            ))}
          </ul>
        </>
      ) : null}
    </SectionFrame>
  );
}

function ProjectLinks({ slug, repo, demo }: { slug: string; repo: string; demo: string }) {
  return (
    <div className={styles.projectLinks}>
      <Link to={`/projects/${slug}`}>Read case study</Link>
      {repo ? (
        <a href={repo} target="_blank" rel="noreferrer noopener">
          <Icon name="github" size={16} /> Code
        </a>
      ) : null}
      {demo ? (
        <a href={demo} target="_blank" rel="noreferrer noopener">
          <Icon name="external" size={16} /> Live
        </a>
      ) : null}
    </div>
  );
}

export function SkillsSection({ model }: SectionProps<"skills">) {
  const { editing, openEditor } = useSudo();
  return (
    <SectionFrame meta={model.meta}>
      <dl className={styles.skills}>
        {model.data.categories.map((cat) => (
          <EditableItem key={cat.id} resource="skill-categories" item={cat} className={styles.skillRow}>
            <dt className={styles.skillCat}>{cat.name}</dt>
            <dd>
              <ul className={styles.skillList}>
                {(cat.skills ?? []).map((s) => (
                  <li key={s.id} data-highlight={s.is_highlighted || undefined} data-hidden={!s.is_published || undefined}>
                    {editing ? (
                      <button type="button" className={styles.skillEdit} onClick={() => openEditor({ resource: "skills", id: s.id })}>
                        {s.name}
                      </button>
                    ) : (
                      s.name
                    )}
                  </li>
                ))}
                {editing ? (
                  <li>
                    <button type="button" className={styles.skillEdit}
                      onClick={() => openEditor({ resource: "skills", defaults: { category: cat.id } })}>
                      + skill
                    </button>
                  </li>
                ) : null}
              </ul>
            </dd>
          </EditableItem>
        ))}
      </dl>
    </SectionFrame>
  );
}

export function EducationSection({ model }: SectionProps<"education">) {
  return (
    <SectionFrame meta={model.meta}>
      <ul className={styles.stack}>
        {model.data.items.map((ed) => (
          <EditableItem key={ed.id} as="li" resource="education" item={ed}>
            {ed.start_date || ed.end_date ? (
              <p className={styles.when}>{dateRange(ed.start_date, ed.end_date, false)}</p>
            ) : null}
            <h3 className={styles.itemTitle}>
              {ed.degree}
              {ed.field_of_study ? `, ${ed.field_of_study}` : ""}
            </h3>
            <p className={styles.org}>
              {ed.institution}
              {ed.grade ? (
                <>
                  <span className={styles.dot} aria-hidden />
                  {ed.grade}
                </>
              ) : null}
            </p>
            {ed.description ? <p className={styles.body}>{ed.description}</p> : null}
            {ed.highlights.length ? (
              <ul className={styles.bullets}>
                {ed.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : null}
          </EditableItem>
        ))}
      </ul>
    </SectionFrame>
  );
}

export function AchievementsSection({ model }: SectionProps<"achievements">) {
  return (
    <SectionFrame meta={model.meta}>
      <ul className={styles.achievements}>
        {model.data.items.map((a) => (
          <EditableItem key={a.id} as="li" resource="achievements" item={a} className={styles.achievement}>
            <span className={styles.kind}>{humanize(a.kind)}</span>
            <div>
              <h3 className={styles.itemTitle}>
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer noopener">
                    {a.title}
                  </a>
                ) : (
                  a.title
                )}
              </h3>
              <p className={styles.org}>
                {[a.organization, monthYear(a.date)].filter(Boolean).join(", ")}
              </p>
              {a.description ? <p className={styles.body}>{a.description}</p> : null}
            </div>
          </EditableItem>
        ))}
      </ul>
    </SectionFrame>
  );
}

export function BlogSection({ model }: SectionProps<"blog">) {
  return (
    <SectionFrame meta={model.meta}>
      <ul className={styles.posts}>
        {model.data.posts.map((post) => (
          <EditableItem key={post.id} as="li" resource="posts" item={post} className={styles.postRow}>
            <Link to={`/blog/${post.slug}`} className={styles.postTitle}>
              {post.title}
            </Link>
            <p className={styles.muted}>
              {post.published_at ? fullDate(post.published_at) : "Draft"}, {post.reading_minutes} min read
            </p>
            {post.excerpt ? <p className={styles.body}>{post.excerpt}</p> : null}
          </EditableItem>
        ))}
      </ul>
      <p>
        <Link to="/blog">Read all writing</Link>
      </p>
    </SectionFrame>
  );
}

export function ArcadeSection({ model }: SectionProps<"arcade">) {
  const { editing } = useSudo();
  // Games ship in a later phase (plan.md Phase 7); only the owner sees this placeholder.
  if (!editing) return null;
  return (
    <SectionFrame meta={model.meta}>
      <EmptyNote>
        {model.data.games.map((g) => g.name).join(", ")} are registered. Their playable versions arrive with the games
        phase; this section stays hidden from visitors until then.
      </EmptyNote>
    </SectionFrame>
  );
}
