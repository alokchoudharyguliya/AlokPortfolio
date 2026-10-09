/**
 * Scene colours come from the same CSS design tokens as the rest of the site
 * (styles/tokens.css), so dark/light themes and the owner's accent colour
 * restyle the 3D scene with no extra configuration.
 */
import type { Vec3 } from "./stations";

export interface Palette {
  dark: boolean;
  bg: Vec3;
  surface: Vec3;
  surface2: Vec3;
  ink: Vec3;
  muted: Vec3;
  signal: Vec3;
  flame: [Vec3, Vec3, Vec3, Vec3];
  link: Vec3;
}

/** Parse "#rgb", "#rrggbb", "rgb(…)" or "rgba(…)" (space or comma separated) into 0–1 channels. */
export function parseCssColor(input: string): Vec3 | null {
  const s = input.trim().toLowerCase();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const full = hex.length === 3 || hex.length === 4 ? [...hex].map((c) => c + c).join("") : hex;
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(full)) return null;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as Vec3;
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
  if (parts.length < 3) return null;
  const channels = parts.map((p) => (p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p) / 255));
  return channels.every((c) => Number.isFinite(c)) ? (channels.map((c) => Math.min(1, Math.max(0, c))) as Vec3) : null;
}

const FALLBACK: Palette = {
  dark: true,
  bg: [0.043, 0.11, 0.173],
  surface: [0.063, 0.149, 0.227],
  surface2: [0.031, 0.086, 0.141],
  ink: [0.902, 0.925, 0.949],
  muted: [0.604, 0.69, 0.765],
  signal: [0.91, 0.639, 0.239],
  flame: [
    [0.949, 0.757, 0.306],
    [0.91, 0.639, 0.239],
    [0.851, 0.471, 0.176],
    [0.706, 0.325, 0.165],
  ],
  link: [0.541, 0.722, 0.949],
};

/** Read the current theme's tokens from `el` (default: <html>). Missing tokens fall back to the dark palette. */
export function readPalette(el: HTMLElement = document.documentElement): Palette {
  const css = getComputedStyle(el);
  const get = (name: string, fallback: Vec3): Vec3 => parseCssColor(css.getPropertyValue(name)) ?? fallback;
  return {
    dark: el.dataset.theme !== "light",
    bg: get("--bg", FALLBACK.bg),
    surface: get("--bg-raised", FALLBACK.surface),
    surface2: get("--bg-sunken", FALLBACK.surface2),
    ink: get("--ink", FALLBACK.ink),
    muted: get("--ink-muted", FALLBACK.muted),
    signal: get("--signal", FALLBACK.signal),
    flame: [get("--flame-1", FALLBACK.flame[0]), get("--flame-2", FALLBACK.flame[1]), get("--flame-3", FALLBACK.flame[2]), get("--flame-4", FALLBACK.flame[3])],
    link: get("--link", FALLBACK.link),
  };
}
