/**
 * ResourceForm — renders any resource from its `ResourceDef` (domain/resources.ts).
 *
 * - Builds default values (create) or uses the fetched object (edit).
 * - Renders one widget per FieldDef type.
 * - On submit, sends only changed fields (PATCH) or all fields (create),
 *   converting UI values back to the API shape (media → id, gallery → ids …).
 * - Maps the backend's error envelope (`fields`) onto the matching inputs.
 *
 * The form element has an `id` so the submit button can live in a Drawer
 * footer (`<button form={id}>`).
 */
import clsx from "clsx";
import { useState } from "react";
import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

import { useAdminList } from "@/api/admin";
import { ApiError } from "@/api/client";
import type { MediaRef } from "@/api/types";
import type { FieldDef, ResourceDef } from "@/domain/resources";
import { Button } from "@/ui/Button";
import { ColorInput, MarkdownInput, MediaThumb, MetricsInput, StringListInput, TagInput, Toggle } from "@/ui/form/inputs";
import styles from "@/ui/form/Form.module.css";
import { useToast } from "@/ui/Toast";

import { MediaPicker } from "../media/MediaPicker";

type Values = Record<string, unknown>;

function emptyValue(field: FieldDef): unknown {
  switch (field.type) {
    case "boolean":
      return false;
    case "stringList":
    case "tags":
    case "gallery":
    case "metrics":
      return [];
    case "media":
      return null;
    default:
      return "";
  }
}

export function initialValues(def: ResourceDef, item?: Values | null): Values {
  const values: Values = {};
  for (const field of def.fields) {
    const raw = item?.[field.name] ?? def.defaults?.[field.name];
    values[field.name] = raw === undefined || raw === null ? emptyValue(field) : raw;
    if (field.type === "relation" && raw != null) values[field.name] = String(raw);
  }
  return values;
}

/** Convert form values to the API payload. Exported for unit tests. */
export function toPayload(def: ResourceDef, values: Values, onlyFields?: Set<string>): Values {
  const out: Values = {};
  for (const field of def.fields) {
    if (onlyFields && !onlyFields.has(field.name)) continue;
    let v = values[field.name];
    switch (field.type) {
      case "media":
        v = v ? (v as MediaRef).id : null;
        break;
      case "gallery":
        v = ((v as MediaRef[]) ?? []).map((m) => m.id);
        break;
      case "stringList":
        v = ((v as string[]) ?? []).map((s) => s.trim()).filter(Boolean);
        break;
      case "metrics":
        v = ((v as { label: string; value: string }[]) ?? []).filter((m) => m.label.trim());
        break;
      case "date":
        v = v ? v : null;
        break;
      case "number":
        v = v === "" || v == null ? null : Number(v);
        break;
      case "relation":
        v = v === "" || v == null ? null : Number(v);
        break;
    }
    out[field.name] = v;
  }
  return out;
}

interface ResourceFormProps {
  def: ResourceDef;
  item?: Values | null;
  formId: string;
  /** Persist the payload; may throw ApiError (field errors are mapped automatically). */
  onSubmit: (payload: Values) => Promise<unknown>;
}

export function ResourceForm({ def, item, formId, onSubmit }: ResourceFormProps) {
  const isCreate = !item;
  const toast = useToast();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<FieldValues>({ defaultValues: initialValues(def, item) });

  const submit = handleSubmit(async (values) => {
    const changed = isCreate ? undefined : new Set(Object.keys(dirtyFields));
    if (changed && changed.size === 0) {
      toast("No changes to save");
      return;
    }
    try {
      await onSubmit(toPayload(def, values, changed));
    } catch (err) {
      if (err instanceof ApiError) {
        for (const [name, messages] of Object.entries(err.fields)) {
          if (def.fields.some((f) => f.name === name)) {
            setError(name, { type: "server", message: messages.join(" ") });
          }
        }
        toast(err.message, "error");
      } else {
        toast("Could not save. Check your connection and try again.", "error");
      }
    }
  });

  return (
    <form id={formId} className={styles.grid} onSubmit={submit} noValidate>
      {def.fields.map((field) => (
        <Controller
          key={field.name}
          name={field.name}
          control={control}
          rules={{ required: field.required ? `${field.label} is required` : false }}
          render={({ field: { value, onChange } }) => (
            <FieldShell field={field} error={errors[field.name]?.message as string | undefined}>
              {(id, invalid) => (
                <FieldWidget field={field} id={id} invalid={invalid} value={value} onChange={onChange} />
              )}
            </FieldShell>
          )}
        />
      ))}
    </form>
  );
}

function FieldShell({
  field,
  error,
  children,
}: {
  field: FieldDef;
  error?: string;
  children: (id: string, invalid: boolean) => ReactNode;
}) {
  const id = `f-${field.name}`;
  const isToggle = field.type === "boolean";
  return (
    <div className={clsx(styles.field, field.wide && styles.wide)}>
      {isToggle ? null : (
        <label htmlFor={id} className={clsx(styles.label, field.required && styles.required)}>
          {field.label}
        </label>
      )}
      {children(id, Boolean(error))}
      {field.help ? <span className={styles.help}>{field.help}</span> : null}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function FieldWidget({
  field,
  id,
  invalid,
  value,
  onChange,
}: {
  field: FieldDef;
  id: string;
  invalid: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const inputCls = clsx(styles.input, invalid && styles.invalid);
  switch (field.type) {
    case "textarea":
      return (
        <textarea id={id} className={clsx(styles.textarea, invalid && styles.invalid)}
          value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
      );
    case "markdown":
      return <MarkdownInput id={id} value={value as string} onChange={onChange} invalid={invalid} />;
    case "boolean":
      return <Toggle id={id} checked={Boolean(value)} onChange={onChange} label={field.label} />;
    case "select":
      return (
        <select id={id} className={clsx(styles.select, invalid && styles.invalid)} value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "relation":
      return <RelationSelect field={field} id={id} invalid={invalid} value={value as string} onChange={onChange} />;
    case "stringList":
      return <StringListInput value={value as string[]} onChange={onChange} placeholder={field.placeholder} />;
    case "tags":
      return <TagInput value={value as string[]} onChange={onChange} />;
    case "metrics":
      return <MetricsInput value={value as { label: string; value: string }[]} onChange={onChange} />;
    case "color":
      return <ColorInput id={id} value={value as string} onChange={onChange} />;
    case "media":
      return <MediaField kind={field.mediaKind} value={value as MediaRef | null} onChange={onChange} />;
    case "gallery":
      return <GalleryField value={value as MediaRef[]} onChange={onChange} />;
    case "number":
      return (
        <input id={id} type="number" className={inputCls} min={field.min} max={field.max}
          value={(value as string | number) ?? ""} onChange={(e) => onChange(e.target.value)} />
      );
    default:
      return (
        <input id={id} className={inputCls}
          type={field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
          value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      );
  }
}

function RelationSelect({
  field,
  id,
  invalid,
  value,
  onChange,
}: {
  field: FieldDef;
  id: string;
  invalid: boolean;
  value: string;
  onChange: (v: unknown) => void;
}) {
  const rel = field.relation!;
  const options = useAdminList<Record<string, unknown>>(rel.endpoint);
  return (
    <select id={id} className={clsx(styles.select, invalid && styles.invalid)} value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose…</option>
      {options.data?.map((o) => (
        <option key={String(o.id)} value={String(o.id)}>
          {String(o[rel.labelKey])}
        </option>
      ))}
    </select>
  );
}

function MediaField({
  kind,
  value,
  onChange,
}: {
  kind?: "image" | "document";
  value: MediaRef | null;
  onChange: (v: MediaRef | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.media}>
      <MediaThumb media={value} />
      <span className={styles.mediaName}>{value ? value.url.split("/").pop() : "None selected"}</span>
      <Button size="sm" onClick={() => setOpen(true)}>
        {value ? "Change" : "Choose"}
      </Button>
      {value ? (
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Remove
        </Button>
      ) : null}
      <MediaPicker open={open} onClose={() => setOpen(false)} onSelect={onChange} kind={kind} />
    </div>
  );
}

function GalleryField({ value, onChange }: { value: MediaRef[]; onChange: (v: MediaRef[]) => void }) {
  const [open, setOpen] = useState(false);
  const items = value ?? [];
  return (
    <div className={styles.field}>
      <div className={styles.galleryGrid}>
        {items.map((m) => (
          <div key={m.id} className={styles.galleryItem}>
            <MediaThumb media={m} />
            <button type="button" aria-label="Remove from gallery" onClick={() => onChange(items.filter((x) => x.id !== m.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div>
        <Button size="sm" icon="plus" onClick={() => setOpen(true)}>
          Add image
        </Button>
      </div>
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        kind="image"
        onSelect={(ref) => !items.some((m) => m.id === ref.id) && onChange([...items, ref])}
      />
    </div>
  );
}
