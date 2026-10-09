/**
 * Contracts of the Terminal shell.
 *
 * A `Command` is a plain object. The provider (ShellProvider) builds a
 * `CommandContext` — everything a command may read or do — and calls
 * `command.run(ctx)`. Commands never import React hooks or routers directly,
 * which keeps them easy to test and to extend.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { Bootstrap, ModeId } from "@/api/types";
import type { Theme } from "@/lib/preferences/PreferencesProvider";
import type { EditTarget } from "@/sudo/SudoProvider";

import type { ArgKind } from "./complete";
import type { Path, VDir } from "./fs";
import type { ParsedLine } from "./parse";

/** One question in a multi-step prompt (e.g. the `message` command). */
export interface PromptStep {
  key: string;
  label: string;
  /** Echo the answer as dots (not used by the current commands, kept for sudo-style prompts). */
  secret?: boolean;
  optional?: boolean;
}

export interface CommandContext {
  parsed: ParsedLine;
  bootstrap: Bootstrap;
  root: VDir;
  cwd: Path;
  history: readonly string[];
  /** Every registered command (for `help`). */
  commands: readonly Command[];
  isOwner: boolean;
  editing: boolean;
  username: string | null;
  qc: QueryClient;

  setCwd(path: Path): void;
  /** Navigate the SPA; the shell marks it so the route view doesn't re-run the command. */
  navigate(to: string): void;
  /** Run another command line, echoed like typed input (used by chips). */
  run(line: string): void;
  clear(): void;
  /** Ask a series of questions, then render `done(answers)`. */
  ask(steps: PromptStep[], done: (answers: Record<string, string>) => ReactNode | Promise<ReactNode>): void;

  prefs: { mode: ModeId; theme: Theme; setMode(mode: ModeId): void; setTheme(theme: Theme): void };
  sudo: { setEditing(on: boolean): void; openEditor(target: EditTarget): void; logout(): Promise<void> };
}

export interface Command {
  name: string;
  aliases?: readonly string[];
  summary: string;
  usage?: string;
  /** Hidden from non-owners' `help`, and refused without an owner session. */
  ownerOnly?: boolean;
  /** Safe to run with no arguments, so `help` renders it as a tappable chip. */
  bare?: boolean;
  /** What argument `index` accepts, for Tab completion. */
  args?(index: number): ArgKind | null;
  run(ctx: CommandContext): ReactNode | Promise<ReactNode>;
}

/** One line of the transcript: an echoed input and/or the output it produced. */
export interface Entry {
  id: number;
  /** Prompt text shown before `line`; null for output-only entries (banner). */
  prompt: string | null;
  line: string | null;
  out: ReactNode;
  pending: boolean;
}

/** A suggestion chip under the transcript. */
export interface Suggestion {
  label: string;
  cmd: string;
}
