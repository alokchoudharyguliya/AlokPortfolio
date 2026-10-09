/**
 * SudoProvider — owner state shared by the public site and the dashboard.
 *
 *   isOwner     : a valid owner session exists (from /auth/me/).
 *   editing     : "edit page" toggle; when on, public pages render drafts and
 *                 inline edit affordances (EditableSection / EditableItem).
 *   openEditor  : opens the single shared EditorDrawer for any resource.
 *
 * It also installs the hidden entry: typing `sudo` anywhere on the public
 * site (outside inputs) jumps to /sudo/login.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useMe } from "@/api/auth";
import { setAnalyticsEnabled } from "@/lib/analytics";
import { KEYS, storage } from "@/lib/storage";

import { EditorDrawer } from "./editor/EditorDrawer";

export interface EditTarget {
  resource: string;
  /** Collection item id. Omit to create a new item. Ignored for singletons. */
  id?: number | null;
  /** Prefill for new items (e.g. skill category when adding from a group). */
  defaults?: Record<string, unknown>;
}

interface SudoContextValue {
  isOwner: boolean;
  editing: boolean;
  setEditing: (on: boolean) => void;
  openEditor: (target: EditTarget) => void;
}

const SudoContext = createContext<SudoContextValue>({
  isOwner: false,
  editing: false,
  setEditing: () => {},
  openEditor: () => {},
});

export function SudoProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const isOwner = me.data?.authenticated === true;
  const [editingPref, setEditingPref] = useState(() => storage.get(KEYS.editing) === "1");
  const [target, setTarget] = useState<EditTarget | null>(null);
  const editing = isOwner && editingPref;

  // Never count the owner's own visits.
  useEffect(() => {
    if (isOwner) setAnalyticsEnabled(false);
  }, [isOwner]);

  const setEditing = useCallback((on: boolean) => {
    storage.set(KEYS.editing, on ? "1" : "0");
    setEditingPref(on);
  }, []);

  const openEditor = useCallback((t: EditTarget) => setTarget(t), []);
  const closeEditor = useCallback(() => setTarget(null), []);

  useSudoShortcut(!isOwner);

  const value = useMemo(
    () => ({ isOwner, editing, setEditing, openEditor }),
    [isOwner, editing, setEditing, openEditor],
  );

  return (
    <SudoContext.Provider value={value}>
      {children}
      {isOwner ? <EditorDrawer target={target} onClose={closeEditor} /> : null}
    </SudoContext.Provider>
  );
}

export function useSudo() {
  return useContext(SudoContext);
}

/** Type "sudo" (not inside a text field) to open the owner login. */
function useSudoShortcut(enabled: boolean) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-4);
      if (buffer === "sudo") {
        buffer = "";
        navigate("/sudo/login");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, navigate]);
}
