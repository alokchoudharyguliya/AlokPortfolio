/**
 * Generic dashboard page for any collection resource in domain/resources.ts:
 * list (drag to reorder when orderable), publish/hide, edit, delete, create.
 * Editing opens the shared EditorDrawer — the same one inline editing uses.
 */
import { useAdminList, useAdminMutations } from "@/api/admin";
import { getResource } from "@/domain/resources";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";

import { useSudo } from "../../SudoProvider";
import styles from "../Dashboard.module.css";
import { SortableList } from "../SortableList";

type Row = Record<string, unknown> & { id: number; is_published?: boolean; is_active?: boolean };

export function ResourcePage({
  resource,
  query,
  createDefaults,
  title,
  intro,
  embedded = false,
}: {
  resource: string;
  query?: Record<string, string | number | undefined>;
  createDefaults?: Record<string, unknown>;
  title?: string;
  intro?: string;
  /** Rendered inside another page (smaller heading). */
  embedded?: boolean;
}) {
  const def = getResource(resource);
  const list = useAdminList<Row>(def.endpoint, query);
  const { update, remove, reorder } = useAdminMutations<Row>(def.endpoint);
  const { openEditor } = useSudo();
  const toast = useToast();
  const items = list.data ?? [];
  const Heading = embedded ? "h2" : "h1";

  const togglePublish = async (row: Row) => {
    await update.mutateAsync({ id: row.id, patch: { is_published: !row.is_published } });
    toast(row.is_published ? "Hidden from visitors" : "Published", "success");
  };

  const onDelete = async (row: Row) => {
    if (!window.confirm(`Delete “${def.title(row)}”? You can restore it from History.`)) return;
    await remove.mutateAsync(row.id);
    toast("Deleted", "success");
  };

  return (
    <section className={styles.stack}>
      <div className={styles.pageHead}>
        <div>
          <Heading className={embedded ? undefined : styles.pageTitle}>{title ?? def.label}</Heading>
          {intro ? <p className={styles.pageIntro}>{intro}</p> : null}
        </div>
        {def.canCreate !== false ? (
          <Button variant="primary" icon="plus" onClick={() => openEditor({ resource, defaults: createDefaults })}>
            New {def.singular}
          </Button>
        ) : null}
      </div>

      {list.isLoading ? <p className={styles.muted}>Loading…</p> : null}
      {list.isSuccess && items.length === 0 ? (
        <p className={styles.muted}>No {def.label.toLowerCase()} yet. Create the first one to show it on the site.</p>
      ) : null}

      {items.length ? (
        <SortableList
          label={def.label}
          items={items}
          disabled={!def.orderable}
          isHidden={(row) => (def.publishable ? row.is_published === false : false)}
          onReorder={(ids) =>
            reorder.mutate(ids, { onSuccess: () => toast("Order saved", "success") })
          }
          renderRow={(row) => (
            <>
              <button type="button" className={styles.rowMain} onClick={() => openEditor({ resource, id: row.id })}>
                <span className={styles.rowTitle}>{def.title(row) || "Untitled"}</span>
                {def.subtitle ? <span className={styles.rowSub}>{def.subtitle(row)}</span> : null}
              </button>
              {def.publishable && row.is_published === false ? <span className={styles.pill}>Hidden</span> : null}
              {row.is_active ? <span className={styles.pill}>Active</span> : null}
              <div className={styles.rowActions}>
                {def.publishable ? (
                  <Button size="sm" variant="ghost" iconOnly icon={row.is_published === false ? "eyeOff" : "eye"}
                    aria-label={row.is_published === false ? "Publish" : "Hide"} onClick={() => togglePublish(row)} />
                ) : null}
                <Button size="sm" variant="ghost" iconOnly icon="pencil" aria-label="Edit"
                  onClick={() => openEditor({ resource, id: row.id })} />
                {def.canDelete !== false ? (
                  <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label="Delete" onClick={() => onDelete(row)} />
                ) : null}
              </div>
            </>
          )}
        />
      ) : null}
    </section>
  );
}
