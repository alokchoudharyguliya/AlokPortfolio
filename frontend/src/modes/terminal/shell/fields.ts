/**
 * Turn the text typed into `set <target> <field> <value…>` into the value the
 * admin API expects, using the same FieldDef the dashboard form is built from.
 * Pure and unit-tested; unsupported field types point the owner to `edit`.
 */
import type { FieldDef, ResourceDef } from "@/domain/resources";

export type Coerced = { ok: true; value: unknown } | { ok: false; error: string };

const fail = (error: string): Coerced => ({ ok: false, error });

/** Field types that need a richer editor than a single line of text. */
const EDITOR_ONLY = new Set(["media", "gallery", "metrics", "relation"]);

export function findField(def: ResourceDef, name: string): FieldDef | undefined {
  const lower = name.toLowerCase();
  return def.fields.find((f) => f.name.toLowerCase() === lower);
}

export function coerceFieldValue(field: FieldDef, raw: string): Coerced {
  const text = raw.trim();
  if (EDITOR_ONLY.has(field.type)) {
    return fail(`"${field.name}" is a ${field.type} field. Use \`edit\` to change it.`);
  }
  switch (field.type) {
    case "boolean": {
      if (/^(true|yes|on|1)$/i.test(text)) return { ok: true, value: true };
      if (/^(false|no|off|0)$/i.test(text)) return { ok: true, value: false };
      return fail(`"${field.name}" expects true or false.`);
    }
    case "number": {
      const n = Number(text);
      if (!text || Number.isNaN(n)) return fail(`"${field.name}" expects a number.`);
      if (field.min !== undefined && n < field.min) return fail(`"${field.name}" must be at least ${field.min}.`);
      if (field.max !== undefined && n > field.max) return fail(`"${field.name}" must be at most ${field.max}.`);
      return { ok: true, value: n };
    }
    case "select": {
      const option = field.options?.find((o) => o.value === text || o.label.toLowerCase() === text.toLowerCase());
      if (!option) {
        const valid = (field.options ?? []).map((o) => o.value).join(", ");
        return fail(`"${field.name}" must be one of: ${valid}.`);
      }
      return { ok: true, value: option.value };
    }
    case "stringList":
    case "tags":
      return { ok: true, value: text ? text.split(",").map((s) => s.trim()).filter(Boolean) : [] };
    case "date":
      if (text && !/^\d{4}-\d{2}-\d{2}$/.test(text)) return fail(`"${field.name}" expects a date like 2025-03-31.`);
      return { ok: true, value: text || null };
    case "color":
      if (!/^#[0-9a-f]{6}$/i.test(text)) return fail(`"${field.name}" expects a colour like #e8a33d.`);
      return { ok: true, value: text };
    default:
      if (field.required && !text) return fail(`"${field.name}" cannot be empty.`);
      return { ok: true, value: text };
  }
}
