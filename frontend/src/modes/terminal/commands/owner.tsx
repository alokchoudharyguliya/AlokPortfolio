/**
 * Owner-only commands: edit, new, set, publish, hide, restore (+ `history <path>`).
 *
 * They reuse the exact write path of the dashboard and inline editor:
 * `patchAdmin` / `restoreVersion` (api/admin.ts) invalidate the same caches,
 * `openEditor` opens the single shared EditorDrawer, and every field comes
 * from the `ResourceDef` registry (domain/resources.ts). Nothing here is
 * trusted for security — the API enforces IsOwner on every call.
 */
import type { ReactNode } from "react";

import { patchAdmin, restoreVersion } from "@/api/admin";
import { api } from "@/api/client";
import type { Paginated, VersionSummary } from "@/api/types";
import { relativeTime } from "@/domain/format";
import { getResource } from "@/domain/resources";
import type { ResourceDef } from "@/domain/resources";

import { coerceFieldValue, findField } from "../shell/fields";
import { DIR_RESOURCE, formatPath, resolve, resourceOf } from "../shell/fs";
import type { VNode } from "../shell/fs";
import { Cmd, describeError, ErrorLine, Heading, Hint, Muted, OkLine, Rows } from "../shell/output";
import type { Command, CommandContext } from "../shell/types";
import { notFound } from "./navigation";

interface Target {
  label: string;
  def: ResourceDef;
  /** Item id, or null for singletons and for a whole collection. */
  id: number | null;
  node: VNode | null;
}

type Resolved = { ok: true; target: Target } | { ok: false; error: ReactNode };

const SINGLETON_ALIASES: Record<string, string> = { profile: "profile", site: "site", settings: "site" };

function resolveTarget(ctx: CommandContext, command: string, arg: string | undefined): Resolved {
  if (!arg) {
    return {
      ok: false,
      error: (
        <ErrorLine>
          {command}: which one? Give a path such as <code>projects/&lt;name&gt;</code>, or <code>profile</code> /{" "}
          <code>site</code>.
        </ErrorLine>
      ),
    };
  }
  const alias = SINGLETON_ALIASES[arg.toLowerCase()];
  if (alias) return { ok: true, target: { label: alias, def: getResource(alias), id: null, node: null } };

  const node = resolve(ctx.root, ctx.cwd, arg);
  if (!node) return { ok: false, error: notFound(ctx, command, arg) };
  const res = resourceOf(node);
  if (!res) return { ok: false, error: <ErrorLine>{command}: {formatPath(node.path)} can't be edited from here. Use the dashboard.</ErrorLine> };
  return { ok: true, target: { label: formatPath(node.path), def: getResource(res.resource), id: res.id, node } };
}

/** Items need an id; singletons don't; a whole collection needs `new` instead. */
function needsItem(command: string, t: Target): ReactNode | null {
  if (t.def.kind === "collection" && t.id === null) {
    return (
      <ErrorLine>
        {command}: {t.label} is a collection. Pick an item inside it, or use <Cmd cmd={`new ${t.node?.name ?? ""}`}>new</Cmd> to add one.
      </ErrorLine>
    );
  }
  return null;
}

const edit: Command = {
  name: "edit",
  summary: "Open the editor for an item (or profile / site)",
  usage: "edit <path|profile|site>",
  ownerOnly: true,
  args: () => "path",
  run(ctx) {
    const r = resolveTarget(ctx, "edit", ctx.parsed.args[0]);
    if (!r.ok) return r.error;
    const bad = needsItem("edit", r.target);
    if (bad) return bad;
    ctx.sudo.openEditor({ resource: r.target.def.key, id: r.target.id });
    return <OkLine>Opening the editor for {r.target.label}.</OkLine>;
  },
};

const create: Command = {
  name: "new",
  summary: "Add a new item to a section",
  usage: "new <section>",
  ownerOnly: true,
  args: () => "dir",
  run(ctx) {
    const arg = ctx.parsed.args[0];
    const node = arg ? resolve(ctx.root, ctx.cwd, arg) : resolve(ctx.root, ctx.cwd, ".");
    if (arg && !node) return notFound(ctx, "new", arg);
    const key = node ? DIR_RESOURCE[node.type === "dir" ? node.name : node.path[0] ?? ""] : undefined;
    if (!key) {
      return (
        <ErrorLine>
          new: name a section — {Object.keys(DIR_RESOURCE).map((d) => (
            <span key={d}>
              <Cmd cmd={`new ${d}`}>{d}</Cmd>{" "}
            </span>
          ))}
        </ErrorLine>
      );
    }
    const def = getResource(key);
    if (def.canCreate === false) return <ErrorLine>new: {def.label} can't be added to.</ErrorLine>;
    ctx.sudo.openEditor({ resource: key, id: null });
    return <OkLine>Opening a blank {def.singular}.</OkLine>;
  },
};

const set: Command = {
  name: "set",
  summary: "Change one field",
  usage: 'set <path|profile|site> <field> <value…>',
  ownerOnly: true,
  args: (i) => (i === 0 ? "path" : null),
  async run(ctx) {
    const [targetArg, fieldName, ...rest] = ctx.parsed.tokens;
    const r = resolveTarget(ctx, "set", targetArg);
    if (!r.ok) return r.error;
    const { target } = r;
    const bad = needsItem("set", target);
    if (bad) return bad;

    if (!fieldName) {
      return (
        <section>
          <Muted>set: which field? Fields of {target.label}:</Muted>
          <p>
            {target.def.fields.map((f) => (
              <span key={f.name}>
                <code>{f.name}</code>{" "}
              </span>
            ))}
          </p>
        </section>
      );
    }
    const field = findField(target.def, fieldName);
    if (!field) return <ErrorLine>set: {target.label} has no field "{fieldName}".</ErrorLine>;
    if (!rest.length) return <ErrorLine>set: give a value, e.g. <code>set {targetArg} {field.name} "new text"</code></ErrorLine>;

    const value = coerceFieldValue(field, rest.join(" "));
    if (!value.ok) return <ErrorLine>set: {value.error}</ErrorLine>;

    try {
      await patchAdmin(ctx.qc, target.def.endpoint, target.id, { [field.name]: value.value });
    } catch (err) {
      return <ErrorLine>set: {describeError(err)}</ErrorLine>;
    }
    return (
      <>
        <OkLine>
          {target.label}.{field.name} updated.
        </OkLine>
        <Hint>
          Undo anytime with <Cmd cmd={`history ${targetArg}`}>history {targetArg}</Cmd> then <code>restore &lt;id&gt;</code>.
        </Hint>
      </>
    );
  },
};

function visibility(name: "publish" | "hide", published: boolean): Command {
  return {
    name,
    summary: published ? "Make an item visible to visitors" : "Hide an item from visitors",
    usage: `${name} <path>`,
    ownerOnly: true,
    args: () => "path",
    async run(ctx) {
      const r = resolveTarget(ctx, name, ctx.parsed.args[0]);
      if (!r.ok) return r.error;
      const { target } = r;
      const bad = needsItem(name, target);
      if (bad) return bad;
      if (!target.def.publishable || target.id === null) {
        return <ErrorLine>{name}: {target.label} has no published/hidden state.</ErrorLine>;
      }
      if (target.node && target.node.draft !== published) {
        return <Muted>{target.label} is already {published ? "published" : "hidden"}.</Muted>;
      }
      try {
        await patchAdmin(ctx.qc, target.def.endpoint, target.id, { is_published: published });
      } catch (err) {
        return <ErrorLine>{name}: {describeError(err)}</ErrorLine>;
      }
      return (
        <OkLine>
          {target.label} is now {published ? "visible to visitors" : "hidden (a draft)"}.
          {!published && !ctx.editing ? " It will disappear from this list until you run `sudo edit on`." : ""}
        </OkLine>
      );
    },
  };
}

/** `history <path>` — recent saved versions of one item, with restore chips. */
export async function versionHistory(ctx: CommandContext): Promise<ReactNode> {
  const r = resolveTarget(ctx, "history", ctx.parsed.args[0]);
  if (!r.ok) return r.error;
  const { target } = r;
  const bad = needsItem("history", target);
  if (bad) return bad;
  try {
    const page = await api.get<Paginated<VersionSummary>>("/admin/versions/", {
      resource: target.def.versionResource,
      // Singletons always live at pk 1 (core.SingletonModel).
      object_id: target.id ?? 1,
      page_size: 8,
    });
    if (!page.results.length) return <Muted>No saved versions of {target.label} yet.</Muted>;
    return (
      <section>
        <Heading meta={`${page.count} saved version${page.count === 1 ? "" : "s"}, newest first`}>{target.label}</Heading>
        <Rows
          rows={page.results.map((v): [string, ReactNode] => [
            `#${v.id}`,
            <>
              {v.action} {relativeTime(v.created_at)}
              {v.user ? <Muted> by {v.user}</Muted> : null}{" "}
              {v.action !== "delete" ? <Cmd cmd={`restore ${v.id}`}>restore</Cmd> : null}
            </>,
          ])}
        />
      </section>
    );
  } catch (err) {
    return <ErrorLine>history: {describeError(err)}</ErrorLine>;
  }
}

const restore: Command = {
  name: "restore",
  summary: "Roll an item back to a saved version",
  usage: "restore <version-id> [--yes]",
  ownerOnly: true,
  async run(ctx) {
    const id = Number(ctx.parsed.args[0]);
    if (!Number.isInteger(id) || id <= 0) {
      return <ErrorLine>restore: give a version id from <code>history &lt;path&gt;</code>.</ErrorLine>;
    }
    if (!ctx.parsed.flags.has("yes")) {
      return (
        <Hint>
          This replaces the current content with version #{id} (the current state stays in history). Confirm:{" "}
          <Cmd cmd={`restore ${id} --yes`}>restore {id} --yes</Cmd>
        </Hint>
      );
    }
    try {
      await restoreVersion(ctx.qc, id);
    } catch (err) {
      return <ErrorLine>restore: {describeError(err)}</ErrorLine>;
    }
    return <OkLine>Restored version #{id}.</OkLine>;
  },
};

export const OWNER_COMMANDS: Command[] = [edit, create, set, visibility("publish", true), visibility("hide", false), restore];
