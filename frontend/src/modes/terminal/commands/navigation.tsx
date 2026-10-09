/** Filesystem-style commands: ls, cd, pwd, cat, tree, open. */
import { Fragment } from "react";
import type { ReactNode } from "react";

import { postQuery } from "@/api/public";
import { ApiError } from "@/api/client";
import type { Post } from "@/api/types";
import { track } from "@/lib/analytics";

import { closest } from "../shell/parse";
import { formatPath, lookup, normalize, resolve } from "../shell/fs";
import type { VFile, VNode } from "../shell/fs";
import { Cmd, ErrorLine, Hint, Muted } from "../shell/output";
import { absPath, DirView, FileView, Listing, TreeView } from "../shell/render";
import type { Command, CommandContext } from "../shell/types";

/** "cat: no such file: x" plus a did-you-mean from the sibling names. */
export function notFound(ctx: CommandContext, command: string, arg: string): ReactNode {
  const path = normalize(ctx.cwd, arg);
  const parent = lookup(ctx.root, path.slice(0, -1));
  const names = parent?.type === "dir" ? parent.children.map((c) => c.name) : [];
  const guess = closest(path[path.length - 1] ?? "", names);
  return (
    <ErrorLine>
      {command}: no such file or directory: {arg}
      {guess ? (
        <>
          {" "}
          — did you mean <Cmd cmd={`${command} ${[...path.slice(0, -1), guess].join("/")}`}>{guess}</Cmd>?
        </>
      ) : null}
    </ErrorLine>
  );
}

/** Public URL of a node that has its own page (so shared links work), else null. */
function pageUrl(node: VFile): string | null {
  if (node.kind === "project") return `/projects/${node.item.slug}`;
  if (node.kind === "post") return `/blog/${node.item.slug}`;
  return null;
}

/** Render one file; posts fetch their body first. */
export async function renderNode(ctx: CommandContext, node: VNode): Promise<ReactNode> {
  if (node.type === "dir") return <DirView dir={node} />;
  let post: Post | undefined;
  if (node.kind === "post") {
    try {
      post = await ctx.qc.fetchQuery({ ...postQuery(node.item.slug), staleTime: 60_000 });
    } catch (err) {
      // A draft has no public body; show its excerpt instead of failing.
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
  }
  return <FileView file={node} post={post} />;
}

const ls: Command = {
  name: "ls",
  summary: "List what is in a directory",
  usage: "ls [-l] [path]",
  bare: true,
  args: () => "path",
  run(ctx) {
    const arg = ctx.parsed.args[0] ?? ".";
    const node = resolve(ctx.root, ctx.cwd, arg);
    if (!node) return notFound(ctx, "ls", arg);
    return <Listing nodes={node.type === "dir" ? node.children : [node]} long={ctx.parsed.flags.has("l")} />;
  },
};

const cd: Command = {
  name: "cd",
  summary: "Change directory (cd .. goes up, cd alone goes home)",
  usage: "cd [path]",
  args: () => "dir",
  run(ctx) {
    const arg = ctx.parsed.args[0] ?? "~";
    const node = resolve(ctx.root, ctx.cwd, arg);
    if (!node) return notFound(ctx, "cd", arg);
    if (node.type !== "dir") return <ErrorLine>cd: not a directory: {arg}</ErrorLine>;
    ctx.setCwd(node.path);
    return null;
  },
};

const pwd: Command = {
  name: "pwd",
  summary: "Print the current directory",
  bare: true,
  run: (ctx) => <code>{formatPath(ctx.cwd)}</code>,
};

const cat: Command = {
  name: "cat",
  aliases: ["show", "read"],
  summary: "Read a file or a whole section",
  usage: "cat <path>…",
  args: () => "path",
  async run(ctx) {
    const args = ctx.parsed.args;
    if (!args.length) {
      return (
        <ErrorLine>
          cat: missing file operand. Try <Cmd cmd="cat about">cat about</Cmd> or <Cmd cmd="ls">ls</Cmd>.
        </ErrorLine>
      );
    }
    const blocks: ReactNode[] = [];
    for (const arg of args) {
      const node = resolve(ctx.root, ctx.cwd, arg);
      blocks.push(<Fragment key={arg}>{node ? await renderNode(ctx, node) : notFound(ctx, "cat", arg)}</Fragment>);
      // A project or post has its own URL; reflect it so the address bar is shareable.
      if (node?.type === "file" && args.length === 1) {
        const url = pageUrl(node);
        if (url) ctx.navigate(url);
      }
    }
    return <>{blocks}</>;
  },
};

const tree: Command = {
  name: "tree",
  summary: "Show everything as an outline",
  usage: "tree [path]",
  bare: true,
  args: () => "dir",
  run(ctx) {
    const arg = ctx.parsed.args[0] ?? ".";
    const node = resolve(ctx.root, ctx.cwd, arg);
    if (!node) return notFound(ctx, "tree", arg);
    if (node.type !== "dir") return <ErrorLine>tree: not a directory: {arg}</ErrorLine>;
    return <TreeView node={node} />;
  },
};

const open: Command = {
  name: "open",
  summary: "Open a link, repo, demo or the resume in a new tab",
  usage: "open <path>",
  args: () => "path",
  run(ctx) {
    const arg = ctx.parsed.args[0];
    if (!arg) return <ErrorLine>open: what? Try <Cmd cmd="open resume">open resume</Cmd> or <Cmd cmd="open links/linkedin">open links/linkedin</Cmd>.</ErrorLine>;
    const node = resolve(ctx.root, ctx.cwd, arg);
    if (!node) return notFound(ctx, "open", arg);
    if (node.type === "dir") return <ErrorLine>open: {arg} is a directory. Use <Cmd cmd={`cat ${absPath(node.path)}`}>cat</Cmd> to read it.</ErrorLine>;

    let url: string | null = null;
    switch (node.kind) {
      case "link":
        url = node.item.url;
        track("outbound_click", { platform: node.item.platform });
        break;
      case "resume":
        url = node.resume.url;
        track("resume_download");
        break;
      case "project":
        url = node.item.demo_url || node.item.repo_url || null;
        break;
      case "contact":
        url = node.profile.email ? `mailto:${node.profile.email}` : null;
        break;
      case "experience":
        url = node.item.organization_url || null;
        break;
      case "achievement":
        url = node.item.url || null;
        break;
      default:
        break;
    }
    if (!url) return <Muted>Nothing to open for {arg}. Use <Cmd cmd={`cat ${absPath(node.path)}`}>cat</Cmd> to read it.</Muted>;
    // Called synchronously from the submit/click handler, so popup blockers allow it.
    if (url.startsWith("mailto:")) window.location.href = url;
    else window.open(url, "_blank", "noopener,noreferrer");
    return <Hint>Opened {url}</Hint>;
  },
};

export const NAVIGATION_COMMANDS: Command[] = [ls, cd, pwd, cat, tree, open];
