/**
 * Building blocks for exhibits: a `Skin` that owns every material of one
 * exhibit, recolours them from the theme palette and fades each *part* in and
 * out as the dive depth changes.
 *
 * Exhibits are drawn as translucent fills with crisp edge lines (no scene
 * lights, no textures), so they follow the site theme and the owner's accent
 * automatically, cost almost nothing to shade, and read well at any zoom.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
} from "three";
import type { Object3D } from "three";
import { Vector3 } from "three";

import type { Palette } from "../scene/palette";
import type { Pose, Vec3 } from "../scene/stations";
import { poseAtDepth, trapezoid } from "./dive";
import type { FadeWindow } from "./dive";

export type Role = "ink" | "signal" | "surface" | "surface2" | "muted" | "hot" | "white";

/** Small seeded PRNG so every exhibit is identical on every load. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Palette channel for a role, as 0–1 sRGB. */
export function roleRgb(p: Palette, role: Role): Vec3 {
  switch (role) {
    case "ink":
      return p.ink;
    case "signal":
      return p.signal;
    case "surface":
      return p.surface;
    case "surface2":
      return p.surface2;
    case "muted":
      return p.muted;
    case "hot":
      return p.flame[0];
    case "white":
      return [1, 1, 1];
  }
}

export const toColor = (rgb: Vec3) => new Color().setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);

type Mat = MeshBasicMaterial | LineBasicMaterial;
interface Entry {
  mat: Mat;
  role: Role;
  base: number;
}

/** A group of geometry that fades as one, according to a depth window. */
export class SkinPart {
  readonly group = new Group();
  readonly entries: Entry[] = [];

  constructor(
    parent: Object3D,
    readonly fade: FadeWindow,
    private readonly order: number,
  ) {
    parent.add(this.group);
  }

  private material<T extends Mat>(mat: T, role: Role, base: number): T {
    mat.transparent = true;
    mat.depthWrite = false;
    mat.toneMapped = false;
    mat.opacity = 0;
    this.entries.push({ mat, role, base });
    return mat;
  }

  /** Translucent solid. */
  fill(geometry: BufferGeometry, role: Role, opacity: number): Mesh {
    const mesh = new Mesh(geometry, this.material(new MeshBasicMaterial(), role, opacity));
    mesh.renderOrder = this.order;
    this.group.add(mesh);
    return mesh;
  }

  /** Line segments from a flat list of endpoints [a0, a1, b0, b1, …]. */
  lines(points: Vec3[], role: Role, opacity: number): LineSegments {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(points.flat(), 3));
    return this.edges(geometry, role, opacity);
  }

  /** Draw a geometry's own line segments (or an EdgesGeometry). */
  edges(geometry: BufferGeometry, role: Role, opacity: number): LineSegments {
    const line = new LineSegments(geometry, this.material(new LineBasicMaterial(), role, opacity));
    line.renderOrder = this.order + 0.5;
    this.group.add(line);
    return line;
  }

  /** One box: translucent body plus outline. */
  box(size: Vec3, pos: Vec3, role: Role, fill: number, line: number, lineRole: Role = role): Group {
    const g = new Group();
    g.position.set(...pos);
    const geometry = new BoxGeometry(...size);
    if (fill > 0) {
      const mesh = new Mesh(geometry, this.material(new MeshBasicMaterial(), role, fill));
      mesh.renderOrder = this.order;
      g.add(mesh);
    }
    if (line > 0) {
      const outline = new LineSegments(new EdgesGeometry(geometry), this.material(new LineBasicMaterial(), lineRole, line));
      outline.renderOrder = this.order + 0.5;
      g.add(outline);
    }
    this.group.add(g);
    return g;
  }

  /** Many identical boxes in one draw call; the returned mesh can be recoloured per instance. */
  boxes(size: Vec3, positions: Vec3[], role: Role, opacity: number): InstancedMesh {
    const mesh = new InstancedMesh(new BoxGeometry(...size), this.material(new MeshBasicMaterial(), role, opacity), Math.max(1, positions.length));
    const m = new Matrix4();
    positions.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p[0], p[1], p[2])));
    mesh.count = positions.length;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = this.order;
    this.group.add(mesh);
    return mesh;
  }
}

export class Skin {
  private readonly parts: SkinPart[] = [];
  private palette: Palette | null = null;

  /** A fading group of geometry attached to `parent`. Later parts draw on top of earlier ones. */
  part(parent: Object3D, fade: FadeWindow): SkinPart {
    const part = new SkinPart(parent, fade, 10 + this.parts.length);
    this.parts.push(part);
    return part;
  }

  get currentPalette(): Palette | null {
    return this.palette;
  }

  setPalette(p: Palette) {
    this.palette = p;
    for (const part of this.parts) {
      for (const e of part.entries) e.mat.color = toColor(roleRgb(p, e.role));
    }
  }

  /** Fade every part for the current depth; `weight` (0–1) is how present the whole exhibit is. */
  update(depth: number, weight: number) {
    for (const part of this.parts) {
      const f = trapezoid(depth, ...part.fade) * weight;
      part.group.visible = f > 0.004;
      if (!part.group.visible) continue;
      for (const e of part.entries) e.mat.opacity = e.base * f;
    }
  }
}

// ------------------------------------------------------------ shared helpers

/** Colours the animated parts of an exhibit use, derived from the theme palette. */
export function tones(p: Palette) {
  const dark = p.dark;
  return {
    signal: toColor(roleRgb(p, "signal")),
    hot: toColor(roleRgb(p, "hot")).multiplyScalar(dark ? 1.1 : 0.9),
    ink: toColor(roleRgb(p, "ink")),
    /** A resting cell: just off the panel colour. */
    idle: toColor(roleRgb(p, "surface2")).lerp(toColor(roleRgb(p, "muted")), dark ? 0.18 : 0.25),
    /** A resting cell inside a lit row. */
    idleLit: toColor(roleRgb(p, "surface2")).lerp(toColor(roleRgb(p, "ink")), 0.4),
  };
}

/** 0–1 hash of an instance index and a time tick, for scattered "busy" patterns that change per tick. */
export function scatter(i: number, tick: number): number {
  const x = Math.sin((i + 1) * 12.9898 + (tick + 1) * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Calls back with a new integer tick only when `rate` ticks per second roll over; null in between. */
export function ticker(rate: number) {
  let last = Number.NaN;
  return (t: number): number | null => {
    const k = Math.floor(t * rate);
    if (k === last) return null;
    last = k;
    return k;
  };
}

export function segmentLengths(path: Vec3[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < path.length; i++) out.push(Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1], path[i + 1][2] - path[i][2]));
  return out;
}

/** Point a fraction `u` of the way along a polyline. */
export function alongPath(path: Vec3[], lengths: number[], u: number, out: Vector3): Vector3 {
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  let d = u * total;
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] === 0 ? 0 : Math.min(1, d / lengths[i]);
      return out.set(
        path[i][0] + (path[i + 1][0] - path[i][0]) * t,
        path[i][1] + (path[i + 1][1] - path[i][1]) * t,
        path[i][2] + (path[i + 1][2] - path[i][2]) * t,
      );
    }
    d -= lengths[i];
  }
  return out.set(...path[0]);
}

/**
 * Camera for a nested exhibit. Level 0 is seen from an `overview` pose given in
 * the root frame; every deeper level is seen face-on from `distance` units in
 * front of its own frame. Framing keeps the subject clear of the caption panel
 * (right of centre on wide screens, higher up on tall ones) and backs off a
 * little more on tall screens on top of the engine's own portrait compensation.
 */
export function createFraming(frames: Object3D[], overview: { pos: Vec3; look: Vec3 }, distance = 15) {
  const SHIFT_WIDE: [number, number] = [-2.2, 0.4];
  const SHIFT_TALL: [number, number] = [0, -2];
  let shift = SHIFT_WIDE;
  let backOff = 1;
  const world = new Vector3();
  const at = (frame: Object3D, local: Vec3): Vec3 => {
    world.set(...local);
    frame.localToWorld(world);
    return [world.x, world.y, world.z];
  };
  const levelPose = (k: number): Pose => {
    if (k === 0) return { pos: at(frames[0], overview.pos), look: at(frames[0], overview.look) };
    return { pos: at(frames[k], [shift[0], shift[1], distance * backOff]), look: at(frames[k], [shift[0], shift[1], 0]) };
  };
  return {
    setAspect(aspect: number) {
      const wide = Math.min(1, Math.max(0, (aspect - 1) / 0.6));
      backOff = 1 + (1 - wide) * 0.7;
      shift = [SHIFT_TALL[0] + (SHIFT_WIDE[0] - SHIFT_TALL[0]) * wide, SHIFT_TALL[1] + (SHIFT_WIDE[1] - SHIFT_TALL[1]) * wide];
    },
    /** World-space camera pose at depth `d`; call after the frames' world matrices are current. */
    poseAt(depth: number): Pose {
      return poseAtDepth(frames.map((_, k) => levelPose(k)), depth);
    },
  };
}

/** The twelve edges of an axis-aligned box as line-segment endpoints, for outlines drawn in bulk. */
export function boxEdges(size: Vec3, pos: Vec3): Vec3[] {
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const c = (sx: number, sy: number, sz: number): Vec3 => [pos[0] + sx * hx, pos[1] + sy * hy, pos[2] + sz * hz];
  const pairs: [Vec3, Vec3][] = [];
  for (const sz of [-1, 1]) {
    pairs.push([c(-1, -1, sz), c(1, -1, sz)], [c(1, -1, sz), c(1, 1, sz)], [c(1, 1, sz), c(-1, 1, sz)], [c(-1, 1, sz), c(-1, -1, sz)]);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) pairs.push([c(sx, sy, -1), c(sx, sy, 1)]);
  return pairs.flat();
}
