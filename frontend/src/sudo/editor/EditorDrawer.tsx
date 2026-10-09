/**
 * The one editor used everywhere: inline editing on the public page and the
 * dashboard's resource pages both open this drawer with an EditTarget.
 * It loads the current object, renders ResourceForm, and saves through the
 * shared admin mutation hooks.
 */
import { useId } from "react";
import { Link } from "react-router-dom";

import { useAdminItem, useAdminMutations, useSingleton } from "@/api/admin";
import { getResource } from "@/domain/resources";
import type { ResourceDef } from "@/domain/resources";
import { Button } from "@/ui/Button";
import { Drawer } from "@/ui/Drawer";
import { useToast } from "@/ui/Toast";

import type { EditTarget } from "../SudoProvider";
import { ResourceForm } from "./ResourceForm";
import styles from "./Editor.module.css";

type Item = Record<string, unknown> & { id: number };

export function EditorDrawer({ target, onClose }: { target: EditTarget | null; onClose: () => void }) {
  if (!target) return null;
  const def = getResource(target.resource);
  return def.kind === "singleton" ? (
    <SingletonEditor def={def} onClose={onClose} />
  ) : (
    <CollectionEditor def={def} target={target} onClose={onClose} />
  );
}

function SingletonEditor({ def, onClose }: { def: ResourceDef; onClose: () => void }) {
  const { query, save } = useSingleton<Record<string, unknown>>(def.endpoint);
  const toast = useToast();
  const formId = useId();

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Edit ${def.label.toLowerCase()}`}
      size="lg"
      footer={
        <EditorFooter formId={formId} saving={save.isPending} onCancel={onClose}
          historyHref={`/sudo/history?resource=${def.versionResource}`} />
      }
    >
      {query.data ? (
        <ResourceForm
          def={def}
          item={query.data}
          formId={formId}
          onSubmit={async (payload) => {
            await save.mutateAsync(payload);
            toast("Saved", "success");
            onClose();
          }}
        />
      ) : (
        <p className={styles.muted}>Loading…</p>
      )}
    </Drawer>
  );
}

function CollectionEditor({ def, target, onClose }: { def: ResourceDef; target: EditTarget; onClose: () => void }) {
  const isCreate = target.id == null;
  const item = useAdminItem<Item>(def.endpoint, target.id);
  const { create, update, remove } = useAdminMutations<Item>(def.endpoint);
  const toast = useToast();
  const formId = useId();

  const onDelete = async () => {
    if (!window.confirm(`Delete this ${def.singular}? You can restore it from History.`)) return;
    await remove.mutateAsync(target.id!);
    toast("Deleted", "success");
    onClose();
  };

  const ready = isCreate || item.data;

  return (
    <Drawer
      open
      onClose={onClose}
      title={isCreate ? `New ${def.singular}` : `Edit ${def.singular}`}
      size="lg"
      footer={
        <EditorFooter
          formId={formId}
          saving={create.isPending || update.isPending}
          onCancel={onClose}
          saveLabel={isCreate ? `Create ${def.singular}` : "Save"}
          onDelete={!isCreate && def.canDelete !== false ? onDelete : undefined}
          deleting={remove.isPending}
          historyHref={isCreate ? undefined : `/sudo/history?resource=${def.versionResource}&object_id=${target.id}`}
        />
      }
    >
      {ready ? (
        <ResourceForm
          key={String(target.id ?? "new")}
          def={isCreate && target.defaults ? { ...def, defaults: { ...def.defaults, ...target.defaults } } : def}
          item={isCreate ? null : item.data}
          formId={formId}
          onSubmit={async (payload) => {
            if (isCreate) {
              await create.mutateAsync(payload as Partial<Item>);
              toast(`Created ${def.singular}`, "success");
            } else {
              await update.mutateAsync({ id: target.id!, patch: payload as Partial<Item> });
              toast("Saved", "success");
            }
            onClose();
          }}
        />
      ) : item.isError ? (
        <p className={styles.muted}>This {def.singular} no longer exists. It may have been deleted.</p>
      ) : (
        <p className={styles.muted}>Loading…</p>
      )}
    </Drawer>
  );
}

function EditorFooter({
  formId,
  saving,
  onCancel,
  saveLabel = "Save",
  onDelete,
  deleting,
  historyHref,
}: {
  formId: string;
  saving: boolean;
  onCancel: () => void;
  saveLabel?: string;
  onDelete?: () => void;
  deleting?: boolean;
  historyHref?: string;
}) {
  return (
    <div className={styles.footer}>
      <div className={styles.footerStart}>
        {onDelete ? (
          <Button variant="danger" icon="trash" onClick={onDelete} loading={deleting}>
            Delete
          </Button>
        ) : null}
        {historyHref ? (
          <Link to={historyHref} className={styles.historyLink} onClick={onCancel}>
            History
          </Link>
        ) : null}
      </div>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" form={formId} loading={saving}>
        {saveLabel}
      </Button>
    </div>
  );
}
