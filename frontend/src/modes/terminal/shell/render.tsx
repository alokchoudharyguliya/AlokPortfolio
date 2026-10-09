/**
 * Turns filesystem nodes into transcript output: the `cat` view of every kind
 * of file, directory overviews, `ls` listings and `tree`.
 *
 * All text comes straight from the same SectionModel data the other modes
 * render, so an owner's edit shows up here without extra wiring.
 */
import type { ReactNode } from "react";

import type { Post } from "@/api/types";
import { dateRange, fullDate, humanize } from "@/domain/format";
import { track } from "@/lib/analytics";
import { Markdown } from "@/ui/Markdown";

import styles from "../Terminal.module.css";
import { formatPath } from "./fs";
import type { Path, VDir, VFile, VNode } from "./fs";
import { Bullets, Cmd, DraftBadge, Ext, Heading, Hint, Muted, Rows, Tags } from "./output";

/** Absolute, shell-style path used in generated commands so chips work from any directory. */
export const absPath = (path: Path) => formatPath(path);

const meta = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

export function FileView({ file, post }: { file: VFile; post?: Post }): ReactNode {
  const draft = file.draft ? <DraftBadge /> : null;

  switch (file.kind) {
    case "about": {
      const { profile } = file;
      return (
        <article className={styles.article}>
          <Heading meta={meta(profile.headline, profile.location)}>{profile.full_name}</Heading>
          {profile.about ? <Markdown className={styles.prose}>{profile.about}</Markdown> : <p>{profile.bio}</p>}
          <Hint>
            Next: <Cmd cmd="cat philosophy">philosophy</Cmd> <Cmd cmd="experience">experience</Cmd>{" "}
            <Cmd cmd="projects">projects</Cmd> <Cmd cmd="skills">skills</Cmd>
          </Hint>
        </article>
      );
    }
    case "philosophy":
      return (
        <article className={styles.article}>
          <Heading>Engineering philosophy</Heading>
          <Markdown className={styles.prose}>{file.profile.philosophy}</Markdown>
        </article>
      );
    case "contact": {
      const { profile, socials } = file;
      return (
        <article className={styles.article}>
          <Heading meta={profile.is_available ? profile.availability : undefined}>Get in touch</Heading>
          <Rows
            rows={[
              ...(profile.email ? ([["email", <Ext key="e" href={`mailto:${profile.email}`}>{profile.email}</Ext>]] as [string, ReactNode][]) : []),
              ...(profile.location ? ([["location", profile.location]] as [string, ReactNode][]) : []),
              ...socials.map((s): [string, ReactNode] => [s.label.toLowerCase(), <Ext key={s.id} href={s.url} platform={s.platform}>{s.url}</Ext>]),
            ]}
          />
          <Hint>
            Prefer a quick note? Run <Cmd cmd="message">message</Cmd> and answer a few questions.
          </Hint>
        </article>
      );
    }
    case "resume":
      return (
        <article className={styles.article}>
          <Heading>Resume</Heading>
          <p>
            <a
              className={styles.ext}
              href={file.resume.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => track("resume_download")}
            >
              {file.resume.label || "Download resume"}
            </a>
          </p>
        </article>
      );
    case "link":
      return (
        <p>
          {file.item.label}: <Ext href={file.item.url} platform={file.item.platform}>{file.item.url}</Ext> {draft}
        </p>
      );
    case "focus": {
      const f = file.item;
      return (
        <article className={styles.article}>
          <Heading meta={f.description}>
            {f.title} {draft}
          </Heading>
          <Bullets items={f.items} />
        </article>
      );
    }
    case "experience": {
      const e = file.item;
      return (
        <article className={styles.article}>
          <Heading
            meta={meta(
              humanize(e.employment_type),
              e.location,
              dateRange(e.start_date, e.end_date, true),
            )}
          >
            {e.role} @ {e.organization_url ? <Ext href={e.organization_url}>{e.organization}</Ext> : e.organization} {draft}
          </Heading>
          {e.summary ? <p>{e.summary}</p> : null}
          <Bullets items={e.highlights} />
          <Tags tags={e.tags} />
        </article>
      );
    }
    case "education": {
      const e = file.item;
      return (
        <article className={styles.article}>
          <Heading meta={meta(e.institution, e.location, dateRange(e.start_date, e.end_date, false), e.grade)}>
            {[e.degree, e.field_of_study].filter(Boolean).join(", ")} {draft}
          </Heading>
          {e.description ? <p>{e.description}</p> : null}
          <Bullets items={e.highlights} />
        </article>
      );
    }
    case "achievement": {
      const a = file.item;
      return (
        <article className={styles.article}>
          <Heading meta={meta(humanize(a.kind), a.organization, fullDate(a.date))}>
            {a.title} {draft}
          </Heading>
          {a.description ? <p>{a.description}</p> : null}
          <Bullets items={a.highlights} />
          {a.url ? (
            <p>
              <Ext href={a.url}>{a.url}</Ext>
            </p>
          ) : null}
        </article>
      );
    }
    case "project": {
      const p = file.item;
      return (
        <article className={styles.article}>
          <Heading
            meta={meta(humanize(p.category), humanize(p.status), dateRange(p.start_date, p.end_date, p.status === "in_progress"), p.role)}
          >
            {p.title} {draft}
          </Heading>
          {p.summary ? <p>{p.summary}</p> : null}
          {p.repo_url || p.demo_url ? (
            <p className={styles.links}>
              {p.repo_url ? <Ext href={p.repo_url}>[code]</Ext> : null}
              {p.demo_url ? <Ext href={p.demo_url}>[live demo]</Ext> : null}
            </p>
          ) : null}
          <Rows rows={p.metrics.map((m): [string, ReactNode] => [m.label, m.value])} />
          <Bullets items={p.highlights} />
          {p.description ? <Markdown className={styles.prose}>{p.description}</Markdown> : null}
          <Tags tags={p.tags} />
        </article>
      );
    }
    case "skills": {
      const c = file.item;
      const skills = c.skills ?? [];
      return (
        <article className={styles.article}>
          <Heading meta={c.description}>
            {c.name} {draft}
          </Heading>
          <Tags tags={[...skills].sort((a, z) => Number(z.is_highlighted) - Number(a.is_highlighted)).map((s) => s.name)} />
        </article>
      );
    }
    case "post": {
      const p = post ?? file.item;
      return (
        <article className={styles.article}>
          <Heading meta={meta(fullDate(file.item.published_at), `${file.item.reading_minutes} min read`)}>
            {p.title} {draft}
          </Heading>
          {post ? (
            <Markdown className={styles.prose}>{post.body}</Markdown>
          ) : (
            <p className={styles.muted}>{file.item.excerpt || "No preview available."}</p>
          )}
          <Tags tags={file.item.tags} />
        </article>
      );
    }
  }
}

/** Overview of a directory: every entry with its one-line summary, each tappable. */
export function DirView({ dir }: { dir: VDir }): ReactNode {
  if (!dir.children.length) return <Muted>{dir.title}: nothing here yet.</Muted>;
  return (
    <section className={styles.article}>
      <Heading meta={dir.summary || undefined}>{dir.title}</Heading>
      <ul className={styles.entries}>
        {dir.children.map((c) => (
          <li key={c.name}>
            <Cmd cmd={`cat ${absPath(c.path)}`}>{c.name}</Cmd> {c.draft ? <DraftBadge /> : null}
            {c.summary ? <span className={styles.muted}> {c.summary}</span> : null}
          </li>
        ))}
      </ul>
      <Hint>Tap a name, or type <code>cat {dir.name}/&lt;name&gt;</code>.</Hint>
    </section>
  );
}

/** `ls`: a grid of tappable names, or `ls -l` rows with summaries. */
export function Listing({ nodes, long }: { nodes: VNode[]; long: boolean }): ReactNode {
  if (!nodes.length) return <Muted>(empty)</Muted>;
  if (long) {
    return (
      <ul className={styles.entries}>
        {nodes.map((n) => (
          <li key={n.name}>
            <Cmd cmd={`cat ${absPath(n.path)}`}>{n.type === "dir" ? `${n.name}/` : n.name}</Cmd>{" "}
            {n.draft ? <DraftBadge /> : null}
            {n.summary ? <span className={styles.muted}> {n.summary}</span> : null}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={styles.grid}>
      {nodes.map((n) => (
        <li key={n.name} className={n.type === "dir" ? styles.dirName : undefined}>
          <Cmd cmd={`cat ${absPath(n.path)}`}>{n.type === "dir" ? `${n.name}/` : n.name}</Cmd>
        </li>
      ))}
    </ul>
  );
}

/** `tree`: box-drawing outline with each name tappable. */
export function TreeView({ node }: { node: VNode }): ReactNode {
  const lines: { prefix: string; node: VNode }[] = [];
  const visit = (n: VNode, prefix: string) => {
    if (n.type !== "dir") return;
    n.children.forEach((child, i) => {
      const last = i === n.children.length - 1;
      lines.push({ prefix: prefix + (last ? "└── " : "├── "), node: child });
      visit(child, prefix + (last ? "    " : "│   "));
    });
  };
  visit(node, "");
  return (
    <pre className={styles.tree}>
      <span>{node.path.length ? formatPath(node.path) : "~"}</span>
      {lines.map(({ prefix, node: n }) => (
        <span key={n.path.join("/")} className={styles.treeRow}>
          <span aria-hidden>{prefix}</span>
          <Cmd cmd={`cat ${absPath(n.path)}`}>{n.type === "dir" ? `${n.name}/` : n.name}</Cmd>
        </span>
      ))}
    </pre>
  );
}
