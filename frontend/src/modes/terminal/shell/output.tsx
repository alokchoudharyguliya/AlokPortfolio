/**
 * Small presentational pieces that command output is built from.
 * `<Cmd>` is the key one: any text can become a tappable command, which is
 * what makes the Terminal usable on touch screens (plan decision D7).
 */
import clsx from "clsx";
import type { ReactNode } from "react";

import { ApiError } from "@/api/client";
import { track } from "@/lib/analytics";

import styles from "../Terminal.module.css";
import { useShell } from "./context";

/** A command the visitor can run by clicking/tapping instead of typing. */
export function Cmd({ cmd, children, title }: { cmd: string; children?: ReactNode; title?: string }) {
  const { run } = useShell();
  return (
    <button type="button" className={styles.cmd} title={title ?? `Run: ${cmd}`} onClick={() => run(cmd)}>
      {children ?? cmd}
    </button>
  );
}

/** External link that reports an outbound click (no personal data). */
export function Ext({ href, children, platform }: { href: string; children: ReactNode; platform?: string }) {
  const web = /^https?:/.test(href);
  return (
    <a
      className={styles.ext}
      href={href}
      {...(web ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      onClick={() => track("outbound_click", platform ? { platform } : {})}
    >
      {children}
    </a>
  );
}

export const Muted = ({ children }: { children: ReactNode }) => <span className={styles.muted}>{children}</span>;

export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p className={styles.error} role="alert">
      {children}
    </p>
  );
}

export const OkLine = ({ children }: { children: ReactNode }) => (
  <p className={styles.ok}>
    <span aria-hidden>✓ </span>
    {children}
  </p>
);

export const Hint = ({ children }: { children: ReactNode }) => <p className={styles.hint}>{children}</p>;

export function Heading({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <header className={styles.heading}>
      <h2 className={styles.headingTitle}>{children}</h2>
      {meta ? <p className={styles.headingMeta}>{meta}</p> : null}
    </header>
  );
}

export function Bullets({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className={styles.bullets}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className={styles.tags} aria-label="Tags">
      {tags.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function DraftBadge() {
  return <span className={styles.draft}>draft</span>;
}

/** Label/value rows, e.g. measured metrics or contact details. */
export function Rows({ rows, className }: { rows: [string, ReactNode][]; className?: string }) {
  if (!rows.length) return null;
  return (
    <dl className={clsx(styles.rows, className)}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Human-readable text for a failed command, including per-field API errors. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    const fields = Object.entries(err.fields).map(([k, v]) => `${k}: ${v.join(" ")}`);
    return fields.length ? `${err.message} (${fields.join("; ")})` : err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
