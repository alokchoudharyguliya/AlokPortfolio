/**
 * Colours of the world. Dark theme = a night drive, light theme = a day drive.
 * Everything is a plain RGB triple (0–1) so the renderer can cross-fade between
 * the two when the visitor toggles the theme, and so it is testable without WebGL.
 * The owner's accent colour (`--signal`) is layered on top for gates and pads.
 */
export type RGB = [number, number, number];

export interface WorldPalette {
  skyTop: RGB;
  skyHorizon: RGB;
  fog: RGB;
  fogFar: number;
  ground: RGB;
  verge: RGB;
  asphalt: RGB;
  marking: RGB;
  mountain: RGB;
  hemiSky: RGB;
  hemiGround: RGB;
  sun: RGB;
  sunIntensity: number;
  ambient: number;
  /** 0 by day, 1 at night: lamps, stars, headlight glow. */
  night: number;
}

export const DAY: WorldPalette = {
  skyTop: [0.28, 0.5, 0.84],
  skyHorizon: [0.86, 0.9, 0.92],
  fog: [0.82, 0.88, 0.92],
  fogFar: 560,
  ground: [0.36, 0.55, 0.3],
  verge: [0.5, 0.46, 0.38],
  asphalt: [0.2, 0.21, 0.23],
  marking: [0.93, 0.93, 0.9],
  mountain: [0.46, 0.55, 0.6],
  hemiSky: [0.85, 0.92, 1],
  hemiGround: [0.38, 0.42, 0.3],
  sun: [1, 0.95, 0.82],
  sunIntensity: 2.4,
  ambient: 0.9,
  night: 0,
};

export const NIGHT: WorldPalette = {
  skyTop: [0.02, 0.04, 0.1],
  skyHorizon: [0.1, 0.16, 0.28],
  fog: [0.05, 0.09, 0.17],
  fogFar: 380,
  ground: [0.07, 0.13, 0.12],
  verge: [0.12, 0.12, 0.13],
  asphalt: [0.1, 0.11, 0.14],
  marking: [0.8, 0.82, 0.85],
  mountain: [0.08, 0.12, 0.2],
  hemiSky: [0.3, 0.4, 0.65],
  hemiGround: [0.08, 0.1, 0.12],
  sun: [0.55, 0.65, 0.95],
  sunIntensity: 0.9,
  ambient: 0.55,
  night: 1,
};

const mix3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mix1 = (a: number, b: number, t: number) => a + (b - a) * t;

/** Blend the day and night palettes: 0 = day, 1 = night. */
export function mixPalette(t: number): WorldPalette {
  const k = Math.min(1, Math.max(0, t));
  const out = {} as WorldPalette;
  for (const key of Object.keys(DAY) as (keyof WorldPalette)[]) {
    const a = DAY[key];
    const b = NIGHT[key];
    (out as unknown as Record<string, unknown>)[key] = Array.isArray(a) ? mix3(a as RGB, b as RGB, k) : mix1(a as number, b as number, k);
  }
  return out;
}
