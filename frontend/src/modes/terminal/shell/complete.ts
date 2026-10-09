/**
 * Tab completion for the Terminal input. Pure: given the current line, the
 * working directory and the filesystem, returns the completed line plus the
 * candidates to list when the completion is ambiguous.
 */
import { displayName, lookup, normalize } from "./fs";
import type { Path, VDir } from "./fs";

/** What a command argument accepts, for completion purposes. */
export type ArgKind = "path" | "dir" | readonly string[];

export interface CompletionSpec {
  /** Command names (and aliases) offered for the first word. */
  commands: readonly string[];
  /** Argument kind for `command` at zero-based argument `index`, or null when free text. */
  argKind(command: string, index: number): ArgKind | null;
}

export interface Completion {
  line: string;
  options: string[];
}

function commonPrefix(items: string[]): string {
  if (!items.length) return "";
  let prefix = items[0];
  for (const item of items.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < item.length && prefix[i].toLowerCase() === item[i].toLowerCase()) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix;
}

export function complete(line: string, cwd: Path, root: VDir, spec: CompletionSpec): Completion {
  const trailing = /\s$/.test(line);
  const parts = line.trimStart().split(/\s+/);
  if (trailing || parts[0] === "") parts.push("");
  const current = parts[parts.length - 1];
  const head = line.slice(0, line.length - current.length);
  const argIndex = parts.length - 2; // -1 while completing the command name itself

  // Candidates are full replacements for the current word; `closing` is appended on a unique match.
  let candidates: { text: string; closing: string }[] = [];

  if (argIndex < 0) {
    candidates = spec.commands.map((c) => ({ text: c, closing: " " }));
  } else {
    const kind = spec.argKind(parts[0].toLowerCase(), argIndex);
    if (!kind) return { line, options: [] };
    if (typeof kind !== "string") {
      candidates = kind.map((v) => ({ text: v, closing: " " }));
    } else {
      const slash = current.lastIndexOf("/");
      const dirPart = slash >= 0 ? current.slice(0, slash + 1) : "";
      const dir = lookup(root, normalize(cwd, dirPart));
      if (dir?.type === "dir") {
        candidates = dir.children
          .filter((c) => kind === "path" || c.type === "dir")
          .map((c) => ({ text: dirPart + displayName(c), closing: c.type === "dir" ? "" : " " }));
      }
    }
  }

  const matches = candidates.filter((c) => c.text.toLowerCase().startsWith(current.toLowerCase()));
  if (!matches.length) return { line, options: [] };
  if (matches.length === 1) return { line: head + matches[0].text + matches[0].closing, options: [] };

  const prefix = commonPrefix(matches.map((m) => m.text));
  return { line: head + (prefix.length > current.length ? prefix : current), options: matches.map((m) => m.text) };
}
