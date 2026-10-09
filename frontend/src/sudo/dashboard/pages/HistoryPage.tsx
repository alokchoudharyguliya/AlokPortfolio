/**
 * Version history: every create / update / delete made through the owner API,
 * with a field-level diff and one-click restore. Deep-linkable from editors:
 * /sudo/history?resource=projects.project&object_id=3
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useRestoreVersion, useVersion, useVersions } from "@/api/admin";
import { relativeTime } from "@/domain/format";
import { RESOURCES } from "@/domain/resources";
import { Button } from "@/ui/Button";
import formStyles from "@/ui/form/Form.module.css";
import { useToast } from "@/ui/Toast";

import styles from "../Dashboard.module.css";

const RESOURCE_OPTIONS = Object.values(RESOURCES).map((r) => ({ value: r.versionResource, label: r.label }));
const ACTION_LABEL = { create: "Created", update: "Edited", delete: "Deleted", restore: "Restored" } as const;

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value.length > 400 ? `${value.slice(0, 400)}…` : value;
  return JSON.stringify(value);
}

export function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const resource = params.get("resource") ?? "";
  const objectId = params.get("object_id") ?? "";
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const versions = useVersions({ resource: resource || undefined, object_id: objectId || undefined, page });
  const detail = useVersion(selected);
  const restore = useRestoreVersion();
  const toast = useToast();

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "resource") next.delete("object_id");
    setParams(next);
    setPage(1);
    setSelected(null);
  };

  return (
    <section className={styles.stack}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>History</h1>
          <p className={styles.pageIntro}>Every change is kept. Pick one to see what changed, then restore it if needed.</p>
        </div>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Content type</span>
          <select className={formStyles.select} value={resource} onChange={(e) => setFilter("resource", e.target.value)}>
            <option value="">Everything</option>
            {RESOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
      {objectId ? (
        <p className={styles.muted}>
          Showing one item only. <button type="button" className={formStyles.tab} onClick={() => setFilter("object_id", "")}>Show all</button>
        </p>
      ) : null}

      <div className={styles.split}>
        <div className={styles.rows}>
          {versions.data?.results.length === 0 ? <p className={styles.panel}>No changes recorded yet.</p> : null}
          {versions.data?.results.map((v) => (
            <button key={v.id} type="button" className={styles.listButton} aria-current={v.id === selected}
              onClick={() => setSelected(v.id)}>
              <span className={styles.rowTitle}>{v.object_repr}</span>
              <span className={styles.rowSub}>
                {ACTION_LABEL[v.action]} {relativeTime(v.created_at)}
                {resource ? "" : ` — ${RESOURCE_OPTIONS.find((o) => o.value === v.resource)?.label ?? v.resource}`}
              </span>
            </button>
          ))}
          {versions.data && (versions.data.next || versions.data.previous) ? (
            <div className={styles.row}>
              <Button size="sm" disabled={!versions.data.previous} onClick={() => setPage((p) => p - 1)}>Newer</Button>
              <Button size="sm" disabled={!versions.data.next} onClick={() => setPage((p) => p + 1)}>Older</Button>
            </div>
          ) : null}
        </div>

        {detail.data ? (
          <article className={`${styles.panel} ${styles.stack}`}>
            <header>
              <h2>{detail.data.object_repr}</h2>
              <p className={styles.muted}>
                {ACTION_LABEL[detail.data.action]} {relativeTime(detail.data.created_at)}
                {detail.data.user ? ` by ${detail.data.user}` : ""}
              </p>
            </header>
            {detail.data.changes.length ? (
              <div style={{ overflowX: "auto" }}>
                <table className={styles.diff}>
                  <thead>
                    <tr><th>Field</th><th>Before</th><th>After</th></tr>
                  </thead>
                  <tbody>
                    {detail.data.changes.map((c) => (
                      <tr key={c.field}>
                        <th scope="row">{c.field}</th>
                        <td className={styles.before}>{show(c.before)}</td>
                        <td className={styles.after}>{show(c.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.muted}>No field changes in this version.</p>
            )}
            <div className={styles.toolbar}>
              <Button variant="primary" icon="history" loading={restore.isPending}
                onClick={async () => {
                  if (!window.confirm("Restore this version? The current state is kept in history too.")) return;
                  await restore.mutateAsync(detail.data!.id);
                  toast("Restored", "success");
                  setSelected(null);
                }}>
                Restore this version
              </Button>
            </div>
          </article>
        ) : (
          <p className={styles.muted}>Select a change to see what changed.</p>
        )}
      </div>
    </section>
  );
}
