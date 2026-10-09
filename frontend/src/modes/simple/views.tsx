/**
 * Simple-mode page views. `HomeView` maps each SectionModel to its Simple
 * component via SECTION_COMPONENTS; the other views render single resources.
 */
import type { ComponentType } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { usePost, usePosts } from "@/api/public";
import type { Bootstrap, SectionKey } from "@/api/types";
import { dateRange, fullDate, humanize } from "@/domain/format";
import type { AnySectionModel } from "@/domain/sections";
import type { SectionComponents, SectionProps } from "@/modes/types";
import { EditButton } from "@/sudo/inline/Editable";
import { Button, LinkButton } from "@/ui/Button";
import { Markdown } from "@/ui/Markdown";

import { HeroSection } from "./hero/HeroSection";
import { TagList } from "./parts";
import { ContactSection } from "./sections/ContactSection";
import {
  AboutSection,
  AchievementsSection,
  ArcadeSection,
  BlogSection,
  EducationSection,
  ExperienceSection,
  FocusSection,
  ProjectsSection,
  SkillsSection,
} from "./sections/content";
import sectionStyles from "./Sections.module.css";
import styles from "./Views.module.css";

export const SECTION_COMPONENTS: SectionComponents = {
  hero: HeroSection,
  about: AboutSection,
  focus: FocusSection,
  experience: ExperienceSection,
  projects: ProjectsSection,
  skills: SkillsSection,
  education: EducationSection,
  achievements: AchievementsSection,
  blog: BlogSection,
  arcade: ArcadeSection,
  contact: ContactSection,
};

export function HomeView({ bootstrap, sections }: { bootstrap: Bootstrap; sections: AnySectionModel[] }) {
  return (
    <>
      {sections.map((model) => {
        const Component = SECTION_COMPONENTS[model.key] as ComponentType<SectionProps<SectionKey>>;
        return <Component key={model.key} model={model} bootstrap={bootstrap} />;
      })}
    </>
  );
}

export function ProjectView({ bootstrap, slug }: { bootstrap: Bootstrap; slug: string }) {
  const project = bootstrap.projects.find((p) => p.slug === slug)!;
  const when = dateRange(project.start_date, project.end_date, project.status === "in_progress");
  return (
    <article className={styles.article}>
      <BackLink to="/#projects" label="All projects" />
      <header className={styles.articleHead}>
        <p className={styles.meta}>
          {[humanize(project.category), humanize(project.status), when, project.role].filter(Boolean).join(", ")}
        </p>
        <h1 className={styles.articleTitle}>{project.title}</h1>
        {project.summary ? <p className={styles.dek}>{project.summary}</p> : null}
        <div className={styles.actions}>
          {project.repo_url ? (
            <LinkButton href={project.repo_url} icon="github" target="_blank" rel="noreferrer noopener">
              View code
            </LinkButton>
          ) : null}
          {project.demo_url ? (
            <LinkButton href={project.demo_url} icon="external" variant="primary" target="_blank" rel="noreferrer noopener">
              Open live demo
            </LinkButton>
          ) : null}
          <EditButton resource="projects" id={project.id} label="Edit project" />
        </div>
      </header>

      {project.cover ? (
        <img className={styles.cover} src={project.cover.url} alt={project.cover.alt} width={project.cover.width ?? undefined}
          height={project.cover.height ?? undefined} />
      ) : null}

      {project.metrics.length ? (
        <dl className={sectionStyles.metrics}>
          {project.metrics.map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {project.highlights.length ? (
        <ul className={sectionStyles.bullets}>
          {project.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}

      {project.description ? <Markdown className={styles.prose}>{project.description}</Markdown> : null}

      {project.gallery.length ? (
        <div className={styles.gallery}>
          {project.gallery.map((img) => (
            <img key={img.id} src={img.url} alt={img.alt} loading="lazy" />
          ))}
        </div>
      ) : null}

      <TagList tags={project.tags} />
    </article>
  );
}

export function BlogIndexView({ bootstrap }: { bootstrap: Bootstrap }) {
  const [page, setPage] = useState(1);
  const posts = usePosts(page);
  const title = bootstrap.sections.find((s) => s.key === "blog")?.title ?? "Writing";
  return (
    <section className={styles.article}>
      <BackLink to="/" label="Home" />
      <h1 className={styles.articleTitle}>{title}</h1>
      {posts.isLoading ? <p className={sectionStyles.muted}>Loading posts…</p> : null}
      {posts.data?.results.length === 0 ? <p className={sectionStyles.muted}>Nothing published yet.</p> : null}
      <ul className={sectionStyles.posts}>
        {posts.data?.results.map((post) => (
          <li key={post.id} className={sectionStyles.postRow}>
            <Link to={`/blog/${post.slug}`} className={sectionStyles.postTitle}>
              {post.title}
            </Link>
            <p className={sectionStyles.muted}>
              {fullDate(post.published_at)}, {post.reading_minutes} min read
            </p>
            {post.excerpt ? <p className={sectionStyles.body}>{post.excerpt}</p> : null}
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        {posts.data?.previous ? <Button onClick={() => setPage((p) => p - 1)}>Newer posts</Button> : null}
        {posts.data?.next ? <Button onClick={() => setPage((p) => p + 1)}>Older posts</Button> : null}
      </div>
    </section>
  );
}

export function PostView({ bootstrap, slug }: { bootstrap: Bootstrap; slug: string }) {
  const post = usePost(slug);
  // Owner previewing a draft: fall back to the drafts bootstrap (no body in list → link to editor).
  const draft = bootstrap.drafts ? bootstrap.posts.find((p) => p.slug === slug) : undefined;

  if (post.isLoading) return <p className={styles.article}>Loading…</p>;
  if (!post.data) {
    if (draft) {
      return (
        <article className={styles.article}>
          <BackLink to="/blog" label="All writing" />
          <h1 className={styles.articleTitle}>{draft.title}</h1>
          <p className={sectionStyles.muted}>This post is a draft, so it isn't public yet.</p>
          <EditButton resource="posts" id={draft.id} label="Edit draft" />
        </article>
      );
    }
    return <NotFoundView bootstrap={bootstrap} />;
  }

  const p = post.data;
  return (
    <article className={styles.article}>
      <BackLink to="/blog" label="All writing" />
      <header className={styles.articleHead}>
        <p className={styles.meta}>
          {fullDate(p.published_at)}, {p.reading_minutes} min read
        </p>
        <h1 className={styles.articleTitle}>{p.title}</h1>
        {p.excerpt ? <p className={styles.dek}>{p.excerpt}</p> : null}
        <EditButton resource="posts" id={p.id} label="Edit post" />
      </header>
      {p.cover ? <img className={styles.cover} src={p.cover.url} alt={p.cover.alt} /> : null}
      <Markdown className={styles.prose}>{p.body}</Markdown>
      <TagList tags={p.tags} label="Topics" />
    </article>
  );
}

export function NotFoundView({ bootstrap }: { bootstrap: Bootstrap }) {
  return (
    <section className={styles.notFound}>
      <p className={styles.code} aria-hidden>
        404
      </p>
      <h1 className={styles.articleTitle}>Nothing at this address</h1>
      <p className={sectionStyles.muted}>
        The page may have moved, or the link has a typo. {bootstrap.profile.full_name}'s work is on the home page.
      </p>
      <LinkButton to="/" variant="primary" icon="home">
        Go to home page
      </LinkButton>
    </section>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <LinkButton to={to} variant="ghost" size="sm" icon="arrowLeft" className={styles.back}>
      {label}
    </LinkButton>
  );
}
