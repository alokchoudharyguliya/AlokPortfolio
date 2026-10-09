/**
 * Inline-editing wrappers used by presentation modes (Simple, 3D).
 *
 *   <EditableSection section={model}>…</EditableSection>
 *       Outlines the section in edit mode and offers "Add <item>" for the
 *       resources that feed it, plus "Rename section" (title/subtitle/visibility).
 *
 *   <EditableItem resource="projects" item={project}>…</EditableItem>
 *       Outlines one item, with Edit and Publish/Hide quick actions. Hidden
 *       items stay visible to the owner but are dimmed.
 *
 * Outside edit mode both render their children untouched, so viewer markup is
 * identical to an owner's preview.
 */
import clsx from "clsx";
import type { ReactNode } from "react";

import { useAdminMutations } from "@/api/admin";
import type { Section } from "@/api/types";
import { SECTION_RESOURCES, getResource } from "@/domain/resources";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";

import { useSudo } from "../SudoProvider";
import styles from "./Editable.module.css";

export function EditableSection({
  meta,
  children,
  className,
}: {
  meta: Section;
  children: ReactNode;
  className?: string;
}) {
  const { editing, openEditor } = useSudo();
  if (!editing) return <>{children}</>;

  const resources = (SECTION_RESOURCES[meta.key] ?? [])
    .map(getResource)
    .filter((def) => def.kind === "collection" && def.canCreate !== false);

  return (
    <div className={clsx(styles.region, styles.section, !meta.is_visible && styles.hidden, className)}>
      <div className={styles.toolbar} role="toolbar" aria-label={`Edit ${meta.title} section`}>
        <span className={styles.badge}>{meta.is_visible ? meta.key : `${meta.key} · hidden`}</span>
        <Button size="sm" variant="ghost" icon="pencil" onClick={() => openEditor({ resource: "sections", id: meta.id })}>
          Section
        </Button>
        {meta.key === "hero" || meta.key === "about" ? (
          <Button size="sm" variant="ghost" icon="user" onClick={() => openEditor({ resource: "profile" })}>
            Profile
          </Button>
        ) : null}
        {resources.map((def) => (
          <Button key={def.key} size="sm" variant="ghost" icon="plus" onClick={() => openEditor({ resource: def.key })}>
            {def.singular}
          </Button>
        ))}
      </div>
      {children}
    </div>
  );
}

export function EditableItem({
  resource,
  item,
  children,
  className,
  as: Tag = "div",
}: {
  resource: string;
  item: { id: number; is_published?: boolean };
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const { editing, openEditor } = useSudo();
  if (!editing) return <Tag className={className}>{children}</Tag>;

  const def = getResource(resource);
  const hidden = def.publishable && item.is_published === false;

  return (
    <Tag className={clsx(styles.region, styles.item, hidden && styles.hidden, className)}>
      <div className={styles.itemTools}>
        <Button size="sm" variant="secondary" iconOnly icon="pencil" aria-label={`Edit ${def.singular}`}
          onClick={() => openEditor({ resource, id: item.id })} />
        {def.publishable ? <PublishToggle resource={resource} item={item} /> : null}
      </div>
      {children}
    </Tag>
  );
}

function PublishToggle({ resource, item }: { resource: string; item: { id: number; is_published?: boolean } }) {
  const def = getResource(resource);
  const { update } = useAdminMutations(def.endpoint);
  const toast = useToast();
  const published = item.is_published !== false;
  return (
    <Button
      size="sm"
      variant="secondary"
      iconOnly
      icon={published ? "eye" : "eyeOff"}
      aria-label={published ? `Hide ${def.singular}` : `Publish ${def.singular}`}
      loading={update.isPending}
      onClick={async () => {
        await update.mutateAsync({ id: item.id, patch: { is_published: !published } as never });
        toast(published ? "Hidden from visitors" : "Published", "success");
      }}
    />
  );
}

/** Small "edit" affordance for a single resource in places without an item wrapper. */
export function EditButton({ resource, id, label }: { resource: string; id?: number; label: string }) {
  const { editing, openEditor } = useSudo();
  if (!editing) return null;
  return (
    <Button size="sm" variant="secondary" icon="pencil" onClick={() => openEditor({ resource, id })}>
      {label}
    </Button>
  );
}
