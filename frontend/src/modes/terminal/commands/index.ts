/**
 * The command registry. To add a command: write a `Command` object in one of
 * the modules below (or a new one) and include it in COMMANDS — help, Tab
 * completion and the permission check pick it up automatically.
 */
import type { ArgKind, CompletionSpec } from "../shell/complete";
import type { VDir } from "../shell/fs";
import type { Command } from "../shell/types";
import { GENERAL_COMMANDS } from "./general";
import { NAVIGATION_COMMANDS } from "./navigation";
import { OWNER_COMMANDS } from "./owner";

export const COMMANDS: readonly Command[] = [...NAVIGATION_COMMANDS, ...GENERAL_COMMANDS, ...OWNER_COMMANDS];

export function findCommand(name: string): Command | undefined {
  return COMMANDS.find((c) => c.name === name || c.aliases?.includes(name));
}

/** Names a visitor can type: commands (owner ones only for the owner) plus section shortcuts like `projects`. */
export function commandNames(root: VDir, isOwner: boolean): string[] {
  const names = COMMANDS.filter((c) => isOwner || !c.ownerOnly).flatMap((c) => [c.name, ...(c.aliases ?? [])]);
  return [...names.filter((n) => /^[a-z]/.test(n)), ...root.children.map((n) => n.name)];
}

export function completionSpec(root: VDir, isOwner: boolean): CompletionSpec {
  return {
    commands: [...new Set(commandNames(root, isOwner))].sort(),
    argKind(command, index): ArgKind | null {
      return findCommand(command)?.args?.(index) ?? null;
    },
  };
}
