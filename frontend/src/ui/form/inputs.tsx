/**
 * Controlled input widgets for the schema-driven ResourceForm. Each widget is
 * value/onChange only (no react-hook-form knowledge), so they can be reused in
 * any form — the contact form, the login form, dashboards.
 */
import clsx from "clsx";
import { useId, useState } from "react";
import type { KeyboardEvent } from "react";

import type { MediaRef, Metric } from "@/api/types";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Markdown } from "@/ui/Markdown";

import styles from "./Form.module.css";

export function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <label className={styles.switchRow} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.switchInput}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.switch} aria-hidden />
      <span>{label}</span>
    </label>
  );
}

export function StringListInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const items = value ?? [];
  const update = (i: number, text: string) => onChange(items.map((x, j) => (j === i ? text : x)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className={styles.list}>
      {items.map((item, i) => (
        <div key={i} className={styles.listRow}>
          <input
            className={styles.input}
            value={item}
            placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
            aria-label={`Item ${i + 1}`}
          />
          <Button size="sm" variant="ghost" iconOnly icon="arrowUp" aria-label="Move up"
            onClick={() => move(i, -1)} disabled={i === 0} />
          <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label="Remove item"
            onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div>
        <Button size="sm" variant="ghost" icon="plus" onClick={() => onChange([...items, ""])}>
          Add item
        </Button>
      </div>
    </div>
  );
}

export function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const tags = value ?? [];
  const commit = () => {
    const name = draft.trim().replace(/,$/, "");
    if (name && !tags.some((t) => t.toLowerCase() === name.toLowerCase())) onChange([...tags, name]);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };
  return (
    <div className={styles.tagBox}>
      {tags.map((t) => (
        <span key={t} className={styles.chip}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      <input
        className={styles.tagInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={tags.length ? "" : "Type and press Enter"}
        aria-label="Add tag"
      />
    </div>
  );
}

export function MetricsInput({ value, onChange }: { value: Metric[]; onChange: (v: Metric[]) => void }) {
  const rows = value ?? [];
  const update = (i: number, patch: Partial<Metric>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className={styles.list}>
      {rows.map((row, i) => (
        <div key={i} className={styles.listRow}>
          <input className={styles.input} value={row.label} placeholder="What (e.g. p95 latency)"
            onChange={(e) => update(i, { label: e.target.value })} aria-label="Measurement" />
          <input className={styles.input} value={row.value} placeholder="Result (e.g. −38%)"
            onChange={(e) => update(i, { value: e.target.value })} aria-label="Result" style={{ maxWidth: "9rem" }} />
          <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label="Remove measurement"
            onClick={() => onChange(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div>
        <Button size="sm" variant="ghost" icon="plus" onClick={() => onChange([...rows, { label: "", value: "" }])}>
          Add measurement
        </Button>
      </div>
    </div>
  );
}

export function MarkdownInput({
  value,
  onChange,
  invalid,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  id?: string;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const tabsId = useId();
  return (
    <div className={styles.field}>
      <div className={styles.tabs} role="tablist" aria-label="Editor view">
        {(["write", "preview"] as const).map((t) => (
          <button key={t} type="button" role="tab" id={`${tabsId}-${t}`} aria-selected={tab === t}
            className={styles.tab} onClick={() => setTab(t)}>
            {t === "write" ? "Write" : "Preview"}
          </button>
        ))}
      </div>
      {tab === "write" ? (
        <textarea id={id} className={clsx(styles.textarea, styles.mono, invalid && styles.invalid)}
          value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className={styles.preview}>
          {value ? <Markdown>{value}</Markdown> : <p className={styles.help}>Nothing to preview yet.</p>}
        </div>
      )}
    </div>
  );
}

export function ColorInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className={styles.colorRow}>
      <input type="color" className={styles.colorSwatch} value={value || "#e8a33d"}
        onChange={(e) => onChange(e.target.value)} aria-label="Pick colour" />
      <input id={id} className={clsx(styles.input, "mono")} value={value ?? ""}
        onChange={(e) => onChange(e.target.value)} maxLength={7} />
    </div>
  );
}

export function MediaThumb({ media }: { media: MediaRef | null }) {
  if (media?.kind === "image") {
    return <img className={styles.thumb} src={media.url} alt={media.alt || ""} />;
  }
  return (
    <span className={styles.thumb}>
      <Icon name={media ? "file" : "image"} />
    </span>
  );
}
