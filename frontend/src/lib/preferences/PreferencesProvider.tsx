/**
 * PreferencesProvider — the two independent presentation switches plus sound.
 *
 *   mode  : "simple" | "terminal" | "3d" | "drive"   (which skin renders the content)
 *   theme : "dark" | "light"               (which colour tokens apply)
 *   sound : boolean                        (UI/game sounds, off by default)
 *
 * Resolution order
 *   mode  → ?mode= URL param → visitor's saved choice → site default (sudo) → "simple"
 *   theme → visitor's saved choice → site default (unless "system") → OS preference
 *
 * The provider writes `data-mode` / `data-theme` on <html> (CSS tokens key off
 * these) and the site accent colour as `--signal`. Unavailable modes (not yet
 * implemented, or 3D without WebGL) fall back to "simple" without overwriting
 * the visitor's saved choice.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { ModeId, SiteConfig } from "@/api/types";
import { track } from "@/lib/analytics";
import { KEYS, storage } from "@/lib/storage";

export type Theme = "dark" | "light";

interface Preferences {
  /** Mode actually rendered (after availability fallback). */
  mode: ModeId;
  /** Mode the visitor asked for (may be unavailable). */
  requestedMode: ModeId;
  theme: Theme;
  sound: boolean;
  setMode: (mode: ModeId) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSound: (on: boolean) => void;
  applySiteDefaults: (site: SiteConfig) => void;
}

const PreferencesContext = createContext<Preferences | null>(null);

const MODES: ModeId[] = ["simple", "terminal", "3d", "drive"];
const isMode = (v: string | null): v is ModeId => v !== null && (MODES as string[]).includes(v);
const isTheme = (v: string | null): v is Theme => v === "dark" || v === "light";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function initialMode(): { mode: ModeId; explicit: boolean } {
  const fromUrl = new URLSearchParams(window.location.search).get("mode");
  if (isMode(fromUrl)) return { mode: fromUrl, explicit: true };
  const saved = storage.get(KEYS.mode);
  if (isMode(saved)) return { mode: saved, explicit: true };
  return { mode: "simple", explicit: false };
}

function initialTheme(): { theme: Theme; explicit: boolean } {
  const saved = storage.get(KEYS.theme);
  if (isTheme(saved)) return { theme: saved, explicit: true };
  return { theme: systemTheme(), explicit: false };
}

export function PreferencesProvider({
  children,
  isModeAvailable,
}: {
  children: ReactNode;
  /** Injected by App from the mode registry, keeping this module registry-agnostic. */
  isModeAvailable: (mode: ModeId) => boolean;
}) {
  const [{ mode: requestedMode, explicit: modeExplicit }, setModeState] = useState(initialMode);
  const [{ theme, explicit: themeExplicit }, setThemeState] = useState(initialTheme);
  const [sound, setSoundState] = useState(() => storage.get(KEYS.sound) === "1");
  const [accent, setAccent] = useState<string | null>(null);

  const mode = isModeAvailable(requestedMode) ? requestedMode : "simple";

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (accent) document.documentElement.style.setProperty("--signal", accent);
  }, [accent]);

  // Follow OS theme changes until the visitor picks a theme explicitly.
  useEffect(() => {
    if (themeExplicit) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setThemeState({ theme: systemTheme(), explicit: false });
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeExplicit]);

  const setMode = useCallback((next: ModeId) => {
    storage.set(KEYS.mode, next);
    setModeState({ mode: next, explicit: true });
    // Drop ?mode= so the saved choice wins on reload.
    const url = new URL(window.location.href);
    if (url.searchParams.has("mode")) {
      url.searchParams.delete("mode");
      window.history.replaceState(window.history.state, "", url);
    }
    track("mode_switch", { to: next });
  }, []);

  const setTheme = useCallback((next: Theme) => {
    storage.set(KEYS.theme, next);
    setThemeState({ theme: next, explicit: true });
    track("theme_switch", { to: next });
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [setTheme, theme],
  );

  const setSound = useCallback((on: boolean) => {
    storage.set(KEYS.sound, on ? "1" : "0");
    setSoundState(on);
  }, []);

  const applySiteDefaults = useCallback(
    (site: SiteConfig) => {
      setAccent(site.accent_color);
      if (!modeExplicit && site.default_mode !== requestedMode) {
        setModeState({ mode: site.default_mode, explicit: false });
      }
      if (!themeExplicit && site.default_theme !== "system" && site.default_theme !== theme) {
        setThemeState({ theme: site.default_theme, explicit: false });
      }
      if (storage.get(KEYS.sound) === null && site.sound_default_on) setSoundState(true);
    },
    [modeExplicit, requestedMode, themeExplicit, theme],
  );

  const value = useMemo<Preferences>(
    () => ({
      mode,
      requestedMode,
      theme,
      sound,
      setMode,
      setTheme,
      toggleTheme,
      setSound,
      applySiteDefaults,
    }),
    [mode, requestedMode, theme, sound, setMode, setTheme, toggleTheme, setSound, applySiteDefaults],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return ctx;
}
