/**
 * The shell's React context, kept apart from the provider so output
 * components (e.g. the clickable <Cmd> chip) and commands can use it without
 * importing the provider — which itself imports the command list.
 */
import { createContext, useContext } from "react";

import type { Completion } from "./complete";
import type { Path, VDir } from "./fs";
import type { Entry, Suggestion } from "./types";

export interface ShellApi {
  entries: Entry[];
  /** The welcome banner is shown until the visitor runs `clear`. */
  showWelcome: boolean;
  /** Text of the active multi-step prompt (replaces the normal prompt), or null. */
  question: string | null;
  prompt: string;
  history: readonly string[];
  cwd: Path;
  root: VDir;
  suggestions: Suggestion[];
  /** Submit what was typed (answers a pending question when one is active). */
  submit(line: string): void;
  /** Run a command as if typed (chips, route deep links). */
  run(line: string): void;
  /** Abort the active question (Ctrl+C). */
  cancel(): void;
  complete(line: string): Completion;
  clear(): void;
}

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell(): ShellApi {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}
