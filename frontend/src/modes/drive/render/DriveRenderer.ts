/**
 * DriveRenderer — the three.js world for Drive mode.
 *
 *   build once      road, shoulders, terrain ribbon, guard rails, lamps, trees, mountains,
 *                   gates (one per section) and their stop lines, sky dome
 *   every frame     camera at the driver's eye, traffic and boost pads near the car,
 *                   day/night cross-fade, adaptive pixel ratio
 *
 * It reads game state (a `RenderFrame`) and never writes to it, and it knows
 * nothing about React: DriveStage (React) owns the loop, calls `render()` and
 * disposes it. Colours come from the day / night palettes (render/palette.ts).
 *
 * Terrain: the ground ribbon follows the road's elevation out to ±28 m and
 * slopes to world level at ±70 m; a flat ground plane follows the camera beyond
 * that, so hills read as embankments and there is never a visible edge.
 */
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  UniformsLib,
  UniformsUtils,
  Vector3,
  WebGLRenderer,
} from "three";
import type { IUniform, Material, ShaderMaterialParameters, Texture } from "three";

import { lowerDpr, shouldDegrade } from "@/modes/three/scene/quality";

import { clamp } from "../engine/rng";
import { ROAD_HALF, roadPoint, sampleRoute, STEP } from "../engine/route";
import type { Route } from "../engine/route";
import { BARRIER } from "../engine/vehicle";
import type { VehicleState } from "../engine/vehicle";
import type { World } from "../engine/world";
import { instancedChunks } from "./assets";
import type { DriveAssets } from "./assets";
import { mixPalette } from "./palette";
import type { RGB, WorldPalette } from "./palette";
import {
  GROUND_EDGE,
  GROUND_FLAT,
  lampPlacements,
  mountainPlacements,
  placementTransform,
  railPlacements,
  scatterTrees,
} from "./placement";
import type { Placement } from "./placement";
import type { DriveQuality } from "./quality";
import { PAD_FRAG, PAD_VERT, ROAD_FRAG, ROAD_VERT, SKY_FRAG, SKY_VERT } from "./shaders";

export interface GateLabel {
  title: string;
  kicker: string;
}

export interface RenderFrame {
  vehicle: VehicleState;
  world: World;
  /** The checkpoint the car is heading for / parked at (that gate glows). */
  targetIndex: number;
  boosting: boolean;
  dt: number;
}

export interface DriveRendererOptions {
  quality: DriveQuality;
  /** Calm / reduced motion: no head-bob, no camera shake. */
  calm: boolean;
  route: Route;
  assets: DriveAssets;
  labels: GateLabel[];
  accent: RGB;
  /** 0 = day, 1 = night (target; the renderer eases toward it). */
  night: number;
  onContextLost?: () => void;
}

const EYE = 1.18; // driver's eye height above the road, m
const GATE_AHEAD = 16; // the arch stands this far beyond the stop point so its banner is visible from the stop
const SUN_DIR = new Vector3(0.3, 0.55, -0.78).normalize();
const VIEW_WINDOW = { behind: 40, ahead: 330 };

const lin = (c: RGB) => new Color().setRGB(c[0], c[1], c[2], SRGBColorSpace);
type Uniforms = Record<string, IUniform>;

export class DriveRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(70, 1, 0.3, 1200);
  private readonly opts: DriveRendererOptions;
  private readonly route: Route;
  private readonly fog = new Fog(0x000000, 40, 500);
  private readonly hemi = new HemisphereLight(0xffffff, 0x444444, 1);
  private readonly sun = new DirectionalLight(0xffffff, 1);

  private readonly roadU: Uniforms;
  private readonly skyU: Uniforms;
  private readonly padU: Uniforms;
  private readonly lambert: { ground: MeshLambertMaterial; plane: MeshLambertMaterial; verge: MeshLambertMaterial; mountain: MeshLambertMaterial };
  private readonly sky: Mesh;
  private readonly groundPlane: Mesh;
  private readonly gates: { group: Group; glow: MeshBasicMaterial; banner: MeshBasicMaterial }[] = [];
  private readonly disposables: { dispose(): void }[] = [];

  private readonly carPool: Map<number, Object3D> = new Map();
  /** Instanced scenery chunks; hidden when they are out of range of the car. */
  private readonly chunks: Object3D[] = [];
  private readonly padPool: Mesh[] = [];
  private nightNow: number;
  private nightTarget: number;
  private accent: RGB;
  private fov = 70;
  private baseFov = 70;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private time = 0;
  private frameTimes: number[] = [];
  private lastNow = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, options: DriveRendererOptions) {
    this.opts = options;
    this.route = options.route;
    this.nightNow = this.nightTarget = options.night;
    this.accent = options.accent;

    // Throws when WebGL is unavailable; the React wrapper falls back to a message + "Read as a page".
    this.renderer = new WebGLRenderer({ canvas, antialias: options.quality.antialias, powerPreference: "high-performance" });
    this.dpr = Math.min(window.devicePixelRatio || 1, options.quality.maxDpr);
    this.renderer.setPixelRatio(this.dpr);

    this.scene.fog = this.fog;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.position.copy(SUN_DIR).multiplyScalar(200);

    this.roadU = {
      uAsphalt: { value: new Vector3() },
      uMarking: { value: new Vector3() },
      uNight: { value: 0 },
      uHeadPos: { value: new Vector3() },
      uHeadDir: { value: new Vector3(0, 0, -1) },
    };
    this.skyU = {
      uTop: { value: new Vector3() },
      uHorizon: { value: new Vector3() },
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: new Vector3() },
      uNight: { value: 0 },
      uTime: { value: 0 },
    };
    this.padU = { uColor: { value: new Vector3() }, uTime: { value: 0 }, uNight: { value: 0 } };

    this.lambert = {
      ground: new MeshLambertMaterial(),
      plane: new MeshLambertMaterial(),
      verge: new MeshLambertMaterial(),
      mountain: new MeshLambertMaterial({ flatShading: true }),
    };
    this.disposables.push(...Object.values(this.lambert));

    this.sky = this.buildSky();
    this.groundPlane = this.buildGroundPlane();
    this.buildRoad();
    this.buildScenery();
    this.buildGates();
    this.buildPadPool();
    this.applyPalette(mixPalette(this.nightNow));

    canvas.addEventListener("webglcontextlost", this.onLost);
    // Dev-only inspection handle (stripped from production builds); used to debug the scene from the console.
    if (import.meta.env.DEV) (window as unknown as { __drive?: unknown }).__drive = { scene: this.scene, camera: this.camera, renderer: this.renderer };
  }

  // ---------------------------------------------------------------- build

  private shader(vert: string, frag: string, uniforms: Uniforms, extra: ShaderMaterialParameters = {}) {
    const m = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: UniformsUtils.merge([UniformsLib.fog, uniforms]),
      fog: true,
      ...extra,
    });
    // UniformsUtils.merge clones values; keep our own references in sync with the material's.
    for (const key of Object.keys(uniforms)) uniforms[key] = m.uniforms[key];
    this.disposables.push(m);
    return m;
  }

  private buildSky(): Mesh {
    const geo = new SphereGeometry(400, 24, 16);
    const mat = new ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.skyU, side: BackSide, depthWrite: false, depthTest: false, fog: false });
    const mesh = new Mesh(geo, mat);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.disposables.push(geo, mat);
    return mesh;
  }

  private buildGroundPlane(): Mesh {
    const geo = new PlaneGeometry(6000, 6000);
    geo.rotateX(-Math.PI / 2);
    const mesh = new Mesh(geo, this.lambert.plane);
    mesh.position.y = -0.4;
    this.scene.add(mesh);
    this.disposables.push(geo);
    return mesh;
  }

  /** A ribbon along the whole centre line: one column of vertices per lateral offset. */
  private ribbon(columns: { lateral: number; dy: (roadY: number) => number }[], uvAcross?: (lateral: number) => number): BufferGeometry {
    const r = this.route;
    const rows = r.x.length;
    const cols = columns.length;
    const pos = new Float32Array(rows * cols * 3);
    const uv = new Float32Array(rows * cols * 2);
    const nor = new Float32Array(rows * cols * 3);
    for (let i = 0; i < rows; i++) {
      const cx = Math.cos(r.heading[i]);
      const sx = Math.sin(r.heading[i]);
      for (let c = 0; c < cols; c++) {
        const k = i * cols + c;
        const lat = columns[c].lateral;
        pos[k * 3] = r.x[i] + cx * lat;
        pos[k * 3 + 1] = r.y[i] + columns[c].dy(r.y[i]);
        pos[k * 3 + 2] = r.z[i] + sx * lat;
        uv[k * 2] = uvAcross ? uvAcross(lat) : 0;
        uv[k * 2 + 1] = r.from + i * STEP;
        nor[k * 3 + 1] = 1;
      }
    }
    const index: number[] = [];
    for (let i = 0; i < rows - 1; i++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = i * cols + c;
        const b = a + 1;
        const d = (i + 1) * cols + c + 1;
        const e = (i + 1) * cols + c;
        index.push(a, b, d, a, d, e);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("uv", new BufferAttribute(uv, 2));
    geo.setAttribute("normal", new BufferAttribute(nor, 3));
    geo.setIndex(index);
    this.disposables.push(geo);
    return geo;
  }

  private buildRoad() {
    const road = this.ribbon(
      [
        { lateral: -ROAD_HALF, dy: () => 0.03 },
        { lateral: ROAD_HALF, dy: () => 0.03 },
      ],
      (lat) => (lat + ROAD_HALF) / (2 * ROAD_HALF),
    );
    this.scene.add(new Mesh(road, this.shader(ROAD_VERT, ROAD_FRAG, this.roadU, { side: DoubleSide })));

    const shoulderW = BARRIER - ROAD_HALF + 0.6;
    const left = this.ribbon([{ lateral: -ROAD_HALF - shoulderW, dy: () => 0.0 }, { lateral: -ROAD_HALF + 0.05, dy: () => 0.0 }]);
    const right = this.ribbon([{ lateral: ROAD_HALF - 0.05, dy: () => 0.0 }, { lateral: ROAD_HALF + shoulderW, dy: () => 0.0 }]);
    for (const g of [left, right]) {
      const m = new Mesh(g, this.lambert.verge);
      (m.material as Material).side = DoubleSide;
      this.scene.add(m);
    }

    // Ground: level with the road out to GROUND_FLAT, then sloping down to world level (y = −0.05) at GROUND_EDGE.
    const ground = this.ribbon([
      { lateral: -GROUND_EDGE, dy: (y) => -y - 0.05 },
      { lateral: -GROUND_FLAT, dy: () => -0.08 },
      { lateral: -(BARRIER + 0.5), dy: () => -0.06 },
      { lateral: BARRIER + 0.5, dy: () => -0.06 },
      { lateral: GROUND_FLAT, dy: () => -0.08 },
      { lateral: GROUND_EDGE, dy: (y) => -y - 0.05 },
    ]);
    const g = new Mesh(ground, this.lambert.ground);
    (g.material as Material).side = DoubleSide;
    this.scene.add(g);
  }

  private matrixFor(p: Placement, scale = p.scale, lift = 0): Matrix4 {
    const t = placementTransform(this.route, p);
    const m = new Matrix4();
    m.compose(new Vector3(t.x, t.y + lift, t.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), t.rotY), new Vector3(scale, scale, scale));
    return m;
  }

  private buildScenery() {
    const { assets, quality } = this.opts;
    const r = this.route;

    const place = (model: Object3D, list: Placement[], matrix: (p: Placement) => Matrix4 = (p) => this.matrixFor(p)) => {
      for (const mesh of instancedChunks(model, list.map((p) => ({ s: p.s, matrix: matrix(p) })))) {
        this.chunks.push(mesh);
        this.scene.add(mesh);
      }
    };

    if (assets.rail) place(assets.rail, railPlacements(r));

    if (assets.lamp) {
      // Lamps stand on the right verge with their arm reaching over the road.
      place(assets.lamp, lampPlacements(r), (p) => {
        const t = placementTransform(r, p);
        return new Matrix4().compose(new Vector3(t.x, t.y, t.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), t.rotY + Math.PI), new Vector3(1, 1, 1));
      });
    }

    const trees = scatterTrees(r, quality.treeDensity);
    assets.trees.forEach((model, variant) => {
      const mine = trees.filter((t) => t.variant === variant || (assets.trees.length === 1 && variant === 0));
      if (mine.length) place(model, mine);
    });
    if (!assets.trees.length) this.scene.add(this.proceduralTrees(trees));

    // Distant hills: one big flat-shaded cone mesh, instanced by hand into a merged group.
    const hills = mountainPlacements(r, quality.mountains);
    const cone = new ConeGeometry(60, 150, 5);
    cone.translate(0, 80, 0);
    this.disposables.push(cone);
    const group = new Group();
    for (const p of hills) {
      const m = new Mesh(cone, this.lambert.mountain);
      const t = placementTransform(r, p);
      m.position.set(t.x, -10, t.z);
      m.rotation.y = t.rotY;
      m.scale.set(p.scale * 1.6, p.scale * 1.2, p.scale * 1.6);
      group.add(m);
    }
    this.scene.add(group);
  }

  /** Stand-in if the tree models failed to load: simple cones on sticks. */
  private proceduralTrees(trees: Placement[]): Group {
    const g = new Group();
    const geo = new ConeGeometry(2, 7, 6);
    geo.translate(0, 4.5, 0);
    const mat = new MeshLambertMaterial({ color: 0x2f6b3a, flatShading: true });
    this.disposables.push(geo, mat);
    for (const p of trees) {
      const m = new Mesh(geo, mat);
      const t = placementTransform(this.route, p);
      m.position.set(t.x, t.y, t.z);
      m.scale.setScalar(p.scale);
      g.add(m);
    }
    return g;
  }

  private bannerTexture(label: GateLabel): Texture {
    const w = 1024;
    const h = 240;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const accent = `rgb(${Math.round(this.accent[0] * 255)}, ${Math.round(this.accent[1] * 255)}, ${Math.round(this.accent[2] * 255)})`;
    ctx.fillStyle = "#0b1c2c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 14, w, 14);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e6ecf2";
    let size = 118;
    ctx.font = `700 ${size}px "Instrument Sans", system-ui, sans-serif`;
    while (ctx.measureText(label.title).width > w - 90 && size > 40) {
      size -= 6;
      ctx.font = `700 ${size}px "Instrument Sans", system-ui, sans-serif`;
    }
    ctx.fillText(label.title, w / 2, h / 2 - 12);
    ctx.fillStyle = "#9ab0c3";
    ctx.font = `500 40px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(label.kicker, w / 2, h - 52);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    this.disposables.push(tex);
    return tex;
  }

  private checkerTexture(): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 16;
    const ctx = canvas.getContext("2d")!;
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? "#f2f2ee" : "#15181c";
        ctx.fillRect(i * 8, j * 8, 8, 8);
      }
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    this.disposables.push(tex);
    return tex;
  }

  private buildGates() {
    const checker = this.checkerTexture();
    const postGeo = new BoxGeometry(0.6, 11, 0.6);
    const beamGeo = new BoxGeometry(BARRIER * 2 - 0.2, 0.55, 0.6);
    const bannerGeo = new PlaneGeometry(BARRIER * 2 - 1.6, 3.3);
    const glowGeo = new BoxGeometry(0.28, 11, 0.28);
    const stopGeo = new PlaneGeometry(ROAD_HALF * 2, 1.1);
    stopGeo.rotateX(-Math.PI / 2);
    const frameMat = new MeshLambertMaterial({ color: 0x24394d });
    const stopMat = new MeshBasicMaterial({ map: checker, fog: true });
    this.disposables.push(postGeo, beamGeo, bannerGeo, glowGeo, stopGeo, frameMat, stopMat);

    this.route.checkpoints.forEach((cp, i) => {
      const label = this.opts.labels[i] ?? { title: cp.key, kicker: "" };
      const at = roadPoint(this.route, cp.s + GATE_AHEAD, 0);
      const group = new Group();
      group.position.set(at.x, at.y, at.z);
      group.rotation.y = -at.heading;

      const banner = new MeshBasicMaterial({ map: this.bannerTexture(label), fog: true });
      const glow = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false, fog: true });
      this.disposables.push(banner, glow);
      for (const side of [-1, 1]) {
        const post = new Mesh(postGeo, frameMat);
        post.position.set(side * (BARRIER - 0.5), 5.5, 0);
        const beam = new Mesh(glowGeo, glow);
        beam.position.set(side * (BARRIER - 0.5), 5.5, 0.42);
        group.add(post, beam);
      }
      const top = new Mesh(beamGeo, frameMat);
      top.position.set(0, 10.8, 0);
      const bottom = new Mesh(beamGeo, frameMat);
      bottom.position.set(0, 6.4, 0);
      const sign = new Mesh(bannerGeo, banner);
      sign.position.set(0, 8.6, 0.05);
      group.add(top, bottom, sign);
      this.scene.add(group);
      this.gates.push({ group, glow, banner });

      const stop = roadPoint(this.route, cp.s + 2.6, 0);
      const line = new Mesh(stopGeo, stopMat);
      line.position.set(stop.x, stop.y + 0.06, stop.z);
      line.rotation.y = -stop.heading;
      this.scene.add(line);
    });
  }

  private buildPadPool() {
    const geo = new PlaneGeometry(3.2, 6);
    geo.rotateX(-Math.PI / 2);
    const mat = this.shader(PAD_VERT, PAD_FRAG, this.padU, { transparent: true, depthWrite: false, side: DoubleSide });
    this.disposables.push(geo);
    for (let i = 0; i < 10; i++) {
      const m = new Mesh(geo, mat);
      m.visible = false;
      this.padPool.push(m);
      this.scene.add(m);
    }
  }

  // ------------------------------------------------------------- settings

  setNight(target: number) {
    this.nightTarget = clamp(target, 0, 1);
  }

  setAccent(accent: RGB) {
    this.accent = accent;
  }

  setSize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    // Portrait phones need a taller field of view or the road becomes a tunnel.
    const t = clamp((1.6 - aspect) / 1.1, 0, 1);
    this.baseFov = 66 + t * 34;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private applyPalette(p: WorldPalette) {
    const far = p.fogFar * this.opts.quality.view;
    this.fog.color.copy(lin(p.fog));
    this.fog.near = 30;
    this.fog.far = far;
    this.scene.background = null;
    this.hemi.color.copy(lin(p.hemiSky));
    this.hemi.groundColor.copy(lin(p.hemiGround));
    this.hemi.intensity = p.ambient;
    this.sun.color.copy(lin(p.sun));
    this.sun.intensity = p.sunIntensity;

    const set = (u: IUniform, c: RGB) => (u.value as Vector3).set(...(lin(c).toArray() as [number, number, number]));
    set(this.roadU.uAsphalt, p.asphalt);
    set(this.roadU.uMarking, p.marking);
    this.roadU.uNight.value = p.night;
    set(this.skyU.uTop, p.skyTop);
    set(this.skyU.uHorizon, p.skyHorizon);
    set(this.skyU.uSunColor, p.sun);
    this.skyU.uNight.value = this.opts.quality.stars ? p.night : p.night * 0.4;
    set(this.padU.uColor, this.accent);
    this.padU.uNight.value = p.night;

    this.lambert.ground.color.copy(lin(p.ground));
    this.lambert.plane.color.copy(lin(p.ground));
    this.lambert.verge.color.copy(lin(p.verge));
    this.lambert.mountain.color.copy(lin(p.mountain));
  }

  // ---------------------------------------------------------------- frame

  render(frame: RenderFrame) {
    if (this.disposed) return;
    const now = performance.now();
    if (this.lastNow) this.adapt(now - this.lastNow);
    this.lastNow = now;
    this.time += frame.dt;

    // Ease day ↔ night when the theme changes.
    if (Math.abs(this.nightNow - this.nightTarget) > 0.002) {
      this.nightNow += (this.nightTarget - this.nightNow) * Math.min(1, frame.dt * 2.5);
      this.applyPalette(mixPalette(this.nightNow));
    }
    this.skyU.uTime.value = this.time;
    this.padU.uTime.value = this.time;

    this.placeCamera(frame);
    this.cullChunks(frame.vehicle.s);
    this.updateTraffic(frame);
    this.updatePads(frame);
    this.updateGates(frame);

    this.sky.position.copy(this.camera.position);
    this.groundPlane.position.x = Math.round(this.camera.position.x / 50) * 50;
    this.groundPlane.position.z = Math.round(this.camera.position.z / 50) * 50;
    this.sun.target.position.copy(this.camera.position);
    this.sun.position.copy(this.camera.position).addScaledVector(SUN_DIR, 200);

    this.renderer.render(this.scene, this.camera);
  }

  private placeCamera(frame: RenderFrame) {
    const v = frame.vehicle;
    const road = sampleRoute(this.route, v.s);
    const p = roadPoint(this.route, v.s, v.x);
    const calm = this.opts.calm;
    const speedF = clamp(v.speed / 52, 0, 1);

    // Head-bob and rumble: small, speed-scaled, and absent in calm mode.
    const bob = calm ? 0 : Math.sin(this.time * 9 * (0.4 + speedF)) * 0.012 * speedF + (v.offRoad ? Math.sin(this.time * 47) * 0.03 : 0);
    const shake = calm ? 0 : v.crashT * 0.05;
    const jitter = shake ? (Math.sin(this.time * 71) + Math.sin(this.time * 53)) * shake : 0;

    this.camera.position.set(p.x, p.y + EYE + bob + jitter * 0.4, p.z);
    // Face where the car is going: the road's heading plus a little for the sideways drift and wheel angle.
    const yaw = Math.atan2(v.vx, Math.max(v.speed, 6)) * 0.7 + v.steer * 0.04;
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = -(p.heading + yaw) + jitter * 0.3;
    this.camera.rotation.x = Math.atan(road.slope) * 0.8 - 0.02;
    this.camera.rotation.z = calm ? 0 : -v.steer * 0.02 - v.vx * 0.003;

    const targetFov = this.baseFov + speedF * 5 + (frame.boosting ? 7 : 0);
    this.fov += (targetFov - this.fov) * Math.min(1, frame.dt * 4);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    const dir = new Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    (this.roadU.uHeadPos.value as Vector3).copy(this.camera.position);
    (this.roadU.uHeadDir.value as Vector3).copy(dir);
  }

  /** Show only the scenery chunks that can be seen: within the fog distance ahead and a little behind. */
  private cullChunks(s: number) {
    const lo = s - 120;
    const hi = s + this.fog.far + 60;
    for (const c of this.chunks) c.visible = c.userData.s1 >= lo && c.userData.s0 <= hi;
  }

  private updateTraffic(frame: RenderFrame) {
    const s = frame.vehicle.s;
    const { cars } = this.opts.assets;
    const want = new Set<number>();
    if (cars.length) {
      const near = frame.world.traffic
        .filter((c) => c.s > s - VIEW_WINDOW.behind && c.s < s + VIEW_WINDOW.ahead)
        .sort((a, b) => Math.abs(a.s - s) - Math.abs(b.s - s))
        .slice(0, this.opts.quality.maxCars);
      for (const car of near) {
        want.add(car.id);
        let obj = this.carPool.get(car.id);
        if (!obj) {
          obj = cars[car.model % cars.length].clone(true);
          this.carPool.set(car.id, obj);
          this.scene.add(obj);
        }
        const pt = roadPoint(this.route, car.s, car.x);
        obj.position.set(pt.x, pt.y, pt.z);
        obj.rotation.y = -pt.heading;
      }
    }
    for (const [id, obj] of this.carPool) {
      if (want.has(id)) continue;
      this.scene.remove(obj);
      this.carPool.delete(id);
    }
  }

  private updatePads(frame: RenderFrame) {
    const s = frame.vehicle.s;
    const near = frame.world.pads.filter((p) => !p.taken && p.s > s - 10 && p.s < s + VIEW_WINDOW.ahead).slice(0, this.padPool.length);
    this.padPool.forEach((mesh, i) => {
      const pad = near[i];
      mesh.visible = Boolean(pad);
      if (!pad) return;
      const pt = roadPoint(this.route, pad.s, pad.x);
      mesh.position.set(pt.x, pt.y + 0.07, pt.z);
      mesh.rotation.y = -pt.heading;
    });
  }

  private updateGates(frame: RenderFrame) {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    this.gates.forEach((g, i) => {
      const active = i === frame.targetIndex;
      g.glow.color.copy(lin(this.accent));
      g.glow.opacity = active ? 0.35 + 0.35 * pulse : 0.1;
    });
  }

  // ------------------------------------------------------------ lifecycle

  /** Step the pixel ratio down if frames run long (never up, to avoid oscillating). */
  private adapt(frameMs: number) {
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length < 90) return;
    if (shouldDegrade(this.frameTimes)) {
      const lower = lowerDpr(this.dpr);
      if (lower !== null) {
        this.dpr = lower;
        this.renderer.setPixelRatio(lower);
        this.renderer.setSize(this.width, this.height, false);
      }
    }
    this.frameTimes = [];
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.opts.onContextLost?.();
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.domElement.removeEventListener("webglcontextlost", this.onLost);
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
