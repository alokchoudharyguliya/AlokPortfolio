/**
 * SceneEngine — the three.js world behind the 3D mode.
 *
 *   World: a GPU die at the origin (instanced "streaming multiprocessor"
 *   tiles on a procedural floor), memory stacks along its sides, tens of
 *   thousands of GPU-animated data particles flowing in from every direction,
 *   a stack of memory-hierarchy rings above it and a pipeline arc for the
 *   career timeline.
 *
 *   Driven from React (ThreeScene.tsx) through a handful of setters:
 *     setStations / setProgress   where the camera is on its scroll flight
 *     setContent                  how many projects / roles / skill tiers exist
 *     setPalette                  colours from the CSS tokens (theme + accent)
 *     setPointer / pulse / setHighlight   interaction
 *     setReveal                   the power-on intro (0 → 1, animated by GSAP)
 *
 * Nothing here imports React or reads the DOM beyond the canvas. All
 * per-frame work is a few uniform writes and one camera update; motion is
 * computed in the shaders. Under reduced motion the loop renders on demand.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  Plane,
} from "three";
import type { IUniform } from "three";

import type { Palette } from "./palette";
import { lowerDpr, shouldDegrade } from "./quality";
import type { QualitySettings } from "./quality";
import {
  PARTICLE_FRAG,
  PARTICLE_VERT,
  PIPE_FRAG,
  PIPE_VERT,
  RING_FRAG,
  RING_VERT,
  SUBSTRATE_FRAG,
  SUBSTRATE_VERT,
  TILE_FRAG,
  TILE_VERT,
} from "./shaders";
import { pickTiles, poseFor, samplePath, stationWeights } from "./stations";
import type { Pose, Vec3 } from "./stations";

export interface EngineOptions {
  quality: QualitySettings;
  reducedMotion: boolean;
  palette: Palette;
  onContextLost?: () => void;
}

export interface EngineContent {
  /** Projects → highlighted tiles on the die. */
  projects: number;
  /** Roles → nodes on the pipeline arc. */
  experiences: number;
  /** Skill groups → rings in the memory hierarchy. */
  tiers: number;
}

const FOV = 42;
const DIE = 24; // die edge length in world units
const RING_MIN = 3;
const RING_MAX = 6;

/** Small seeded PRNG so the die and particle lanes are identical on every load. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (x: number) => x * x * (3 - 2 * x);
type Uniforms = Record<string, IUniform>;
const vec3 = (v: Vec3) => new Vector3(v[0], v[1], v[2]);

export class SceneEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 400);
  private readonly q: QualitySettings;
  private readonly reduced: boolean;
  private readonly onContextLost?: () => void;

  /** Uniforms shared by every material, so one write updates the whole scene. */
  private readonly shared: Uniforms = {
    uTime: { value: 0 },
    uDark: { value: 1 },
    uOut: { value: 0 },
    uReveal: { value: 0 },
    uStageProjects: { value: 0 },
    uBg: { value: new Vector3() },
    uInk: { value: new Vector3() },
    uSignal: { value: new Vector3() },
    uSurface: { value: new Vector3() },
    uSurface2: { value: new Vector3() },
    uF1: { value: new Vector3() },
    uF2: { value: new Vector3() },
    uF3: { value: new Vector3() },
    uF4: { value: new Vector3() },
  };
  private readonly tileU: Uniforms = { uHi: { value: -1 }, uHiAmt: { value: 0 } };
  private readonly substrateU: Uniforms = {
    uPointer: { value: new Vector2() },
    uHover: { value: 0 },
    uPulsePos: { value: new Vector2() },
    uPulseAge: { value: 99 },
  };
  private readonly particleU: Uniforms = { uPixel: { value: 600 } };
  private readonly ringU: Uniforms = { uWeight: { value: 0 } };
  private readonly pipeU: Uniforms = { uWeight: { value: 0 } };

  private substrate!: Mesh;
  private tiles!: InstancedMesh;
  private stacks!: InstancedMesh;
  private particles!: Points;
  private rings: Mesh[] = [];
  private pipe: Mesh | null = null;
  private nodes: InstancedMesh | null = null;
  private readonly nodeMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false });
  private readonly additive: ShaderMaterial[] = [];

  private keys: string[] = ["ambient"];
  private poses: Pose[] = [poseFor("ambient")];
  private targetF = 0;
  private f = 0;
  private time = 0;
  private reveal = 0;
  private hi = -1;
  private projectTiles: number[] = [];
  private tileHeights: Float32Array = new Float32Array(0);
  private ringBoost: number[] = [];
  private ringHi = -1;

  private readonly pointer = new Vector2(0, 0);
  private pointerActive = false;
  private parallax = new Vector2(0, 0);
  private readonly raycaster = new Raycaster();
  private readonly floor = new Plane(new Vector3(0, 1, 0), 0);
  private readonly hit = new Vector3();

  private dpr = 1;
  private width = 1;
  private height = 1;
  private raf = 0;
  private last = 0;
  private running = false;
  private paused = false;
  private pendingRender = false;
  private frameTimes: number[] = [];
  private frames = 0;
  private drawFraction = 1;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, options: EngineOptions) {
    this.canvas = canvas;
    this.q = options.quality;
    this.reduced = options.reducedMotion;
    this.onContextLost = options.onContextLost;

    // Throws when WebGL is unavailable; the React wrapper falls back to a content-only page.
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: this.q.antialias,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.q.maxDpr);

    this.buildSubstrate();
    this.buildTiles();
    this.buildParticles();
    this.buildRings(RING_MIN);
    this.buildPipeline(2);
    this.setPalette(options.palette);
    this.setContent({ projects: 0, experiences: 2, tiers: RING_MIN });

    canvas.addEventListener("webglcontextlost", this.onLost);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  // ------------------------------------------------------------ building

  private material(vert: string, frag: string, uniforms: Uniforms, opts: { transparent?: boolean; additive?: boolean } = {}) {
    const m = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { ...this.shared, ...uniforms },
      transparent: opts.transparent ?? false,
      depthWrite: !opts.transparent,
    });
    if (opts.additive) this.additive.push(m);
    return m;
  }

  private buildSubstrate() {
    const geometry = new PlaneGeometry(170, 170, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.substrate = new Mesh(geometry, this.material(SUBSTRATE_VERT, SUBSTRATE_FRAG, this.substrateU, { transparent: true }));
    this.substrate.renderOrder = 0;
    this.scene.add(this.substrate);
  }

  private tileMaterial() {
    return this.material(TILE_VERT, TILE_FRAG, this.tileU);
  }

  private buildTiles() {
    const g = this.q.grid;
    const rand = mulberry32(7);
    const box = new BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const material = this.tileMaterial();

    const count = g * g;
    this.tiles = new InstancedMesh(box.clone(), material, count);
    const seed = new Float32Array(count);
    const index = new Float32Array(count);
    const project = new Float32Array(count);
    this.tileHeights = new Float32Array(count);
    const m = new Matrix4();
    const q = new Quaternion();
    for (let i = 0; i < count; i++) {
      this.tileHeights[i] = 0.3 + rand() * 0.55;
      seed[i] = rand();
      index[i] = i;
    }
    this.layoutTiles();
    this.tiles.geometry.setAttribute("aSeed", new InstancedBufferAttribute(seed, 1));
    this.tiles.geometry.setAttribute("aIndex", new InstancedBufferAttribute(index, 1));
    this.tiles.geometry.setAttribute("aProject", new InstancedBufferAttribute(project, 1).setUsage(DynamicDrawUsage));
    this.tiles.frustumCulled = false;
    this.tiles.instanceMatrix.setUsage(DynamicDrawUsage);
    this.scene.add(this.tiles);

    // Memory stacks (HBM) flank the die; same material, so they share the activity wave.
    const slots = 4;
    this.stacks = new InstancedMesh(box.clone(), material, slots * 2);
    const sSeed = new Float32Array(slots * 2);
    const sIndex = new Float32Array(slots * 2);
    const sProject = new Float32Array(slots * 2);
    for (let k = 0; k < slots * 2; k++) {
      const side = k < slots ? -1 : 1;
      const z = ((k % slots) - (slots - 1) / 2) * 6;
      const h = 1.3 + rand() * 1.4;
      m.compose(new Vector3(side * 17.5, 0, z), q, new Vector3(3, h, 5));
      this.stacks.setMatrixAt(k, m);
      sSeed[k] = rand();
      sIndex[k] = 1000 + k;
    }
    this.stacks.geometry.setAttribute("aSeed", new InstancedBufferAttribute(sSeed, 1));
    this.stacks.geometry.setAttribute("aIndex", new InstancedBufferAttribute(sIndex, 1));
    this.stacks.geometry.setAttribute("aProject", new InstancedBufferAttribute(sProject, 1));
    this.stacks.frustumCulled = false;
    this.scene.add(this.stacks);
    box.dispose();
  }

  /** (Re)compose every tile matrix from its base height; project tiles stand taller so they read as landmarks. */
  private layoutTiles() {
    const g = this.q.grid;
    const pitch = DIE / g;
    const boosted = new Set(this.projectTiles);
    const m = new Matrix4();
    const q = new Quaternion();
    for (let i = 0; i < this.tileHeights.length; i++) {
      const cx = (i % g) - (g - 1) / 2;
      const cz = Math.floor(i / g) - (g - 1) / 2;
      const w = pitch * 0.8;
      const h = boosted.has(i) ? Math.max(this.tileHeights[i], 0.95) : this.tileHeights[i];
      m.compose(new Vector3(cx * pitch, 0, cz * pitch), q, new Vector3(w, h, w));
      this.tiles.setMatrixAt(i, m);
    }
    this.tiles.instanceMatrix.needsUpdate = true;
  }

  private buildParticles() {
    const n = this.q.particles;
    const rand = mulberry32(21);
    const g = this.q.grid;
    const pitch = DIE / g;
    const start = new Float32Array(n * 3);
    const end = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    const speed = new Float32Array(n);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // Source: a wide shell around the die. Target: the top of a random tile.
      const a = rand() * Math.PI * 2;
      const r = 46 + rand() * 42;
      start[i * 3] = Math.cos(a) * r;
      start[i * 3 + 1] = 3 + rand() * 30;
      start[i * 3 + 2] = Math.sin(a) * r;
      const tx = Math.floor(rand() * g) - (g - 1) / 2;
      const tz = Math.floor(rand() * g) - (g - 1) / 2;
      end[i * 3] = tx * pitch + (rand() - 0.5) * pitch * 0.6;
      end[i * 3 + 1] = 0.5 + rand() * 0.6;
      end[i * 3 + 2] = tz * pitch + (rand() - 0.5) * pitch * 0.6;
      phase[i] = rand();
      speed[i] = 0.6 + rand() * 1.1;
      size[i] = 0.06 + rand() * 0.1;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(end, 3));
    geometry.setAttribute("aStart", new BufferAttribute(start, 3));
    geometry.setAttribute("aPhase", new BufferAttribute(phase, 1));
    geometry.setAttribute("aSpeed", new BufferAttribute(speed, 1));
    geometry.setAttribute("aSize", new BufferAttribute(size, 1));
    const material = this.material(PARTICLE_VERT, PARTICLE_FRAG, this.particleU, { transparent: true, additive: true });
    this.particles = new Points(geometry, material);
    this.particles.frustumCulled = false;
    this.particles.renderOrder = 3;
    this.scene.add(this.particles);
  }

  private clearRings() {
    for (const ring of this.rings) {
      this.scene.remove(ring);
      ring.geometry.dispose();
      const idx = this.additive.indexOf(ring.material as ShaderMaterial);
      if (idx >= 0) this.additive.splice(idx, 1);
      (ring.material as ShaderMaterial).dispose();
    }
    this.rings = [];
    this.ringBoost = [];
  }

  private buildRings(count: number) {
    this.clearRings();
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const radius = 16 - t * 9;
      const geometry = new RingGeometry(radius - 0.55, radius, 128, 1);
      geometry.rotateX(-Math.PI / 2);
      const material = this.material(
        RING_VERT,
        RING_FRAG,
        { ...this.ringU, uTier: { value: i }, uHot: { value: t }, uBoost: { value: 0 }, uSpeed: { value: (0.15 + t * 0.35) * (i % 2 ? -1 : 1) } },
        { transparent: true, additive: true },
      );
      const ring = new Mesh(geometry, material);
      ring.position.y = 4.5 + i * 2.4;
      ring.renderOrder = 2;
      this.rings.push(ring);
      this.ringBoost.push(0);
      this.scene.add(ring);
    }
  }

  private clearPipeline() {
    if (this.pipe) {
      this.scene.remove(this.pipe);
      this.pipe.geometry.dispose();
      const idx = this.additive.indexOf(this.pipe.material as ShaderMaterial);
      if (idx >= 0) this.additive.splice(idx, 1);
      (this.pipe.material as ShaderMaterial).dispose();
      this.pipe = null;
    }
    if (this.nodes) {
      this.scene.remove(this.nodes);
      this.nodes.geometry.dispose();
      this.nodes = null;
    }
  }

  private buildPipeline(nodeCount: number) {
    this.clearPipeline();
    const curve = new CatmullRomCurve3([
      new Vector3(-15, 2.2, -2),
      new Vector3(-8, 5.8, -1),
      new Vector3(0, 4, -3),
      new Vector3(8, 5.8, -1),
      new Vector3(15, 2.2, -2),
    ]);
    const tube = new TubeGeometry(curve, 180, 0.08, 6, false);
    const material = this.material(PIPE_VERT, PIPE_FRAG, this.pipeU, { transparent: true, additive: true });
    this.pipe = new Mesh(tube, material);
    this.pipe.renderOrder = 2;
    this.scene.add(this.pipe);

    const count = Math.max(1, nodeCount);
    this.nodes = new InstancedMesh(new SphereGeometry(0.42, 16, 12), this.nodeMaterial, count);
    const m = new Matrix4();
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : 0.08 + (i / (count - 1)) * 0.84;
      m.makeTranslation(curve.getPoint(t));
      this.nodes.setMatrixAt(i, m);
    }
    this.nodes.renderOrder = 2;
    this.scene.add(this.nodes);
  }

  // ------------------------------------------------------------ public API

  setContent(content: EngineContent) {
    // Projects → tiles on the die.
    this.projectTiles = pickTiles(content.projects, this.q.grid);
    const attr = this.tiles.geometry.getAttribute("aProject") as InstancedBufferAttribute;
    attr.array.fill(0);
    for (const cell of this.projectTiles) attr.array[cell] = 1;
    attr.needsUpdate = true;
    this.layoutTiles();

    const tiers = Math.min(RING_MAX, Math.max(RING_MIN, content.tiers));
    if (tiers !== this.rings.length) this.buildRings(tiers);
    if (Math.max(1, content.experiences) !== this.nodes?.count) this.buildPipeline(content.experiences);
    this.applyBlending();
    this.requestRender();
  }

  /** The ordered section keys on the page; the flight path is built from their poses. */
  setStations(keys: string[]) {
    this.keys = keys.length ? keys : ["ambient"];
    this.poses = this.keys.map(poseFor);
    this.targetF = Math.min(this.targetF, this.keys.length - 1);
    this.f = Math.min(this.f, this.keys.length - 1);
    this.requestRender();
  }

  /** Fractional station index to fly to (from fractionalStation()). */
  setProgress(f: number) {
    this.targetF = Math.min(Math.max(f, 0), this.keys.length - 1);
    this.requestRender();
  }

  setReveal(v: number) {
    this.reveal = Math.min(Math.max(v, 0), 1);
    this.shared.uReveal.value = this.reveal;
    this.requestRender();
  }

  setPalette(p: Palette) {
    const u = this.shared;
    u.uDark.value = p.dark ? 1 : 0;
    (u.uBg.value as Vector3).copy(vec3(p.bg));
    (u.uInk.value as Vector3).copy(vec3(p.ink));
    (u.uSignal.value as Vector3).copy(vec3(p.signal));
    (u.uSurface.value as Vector3).copy(vec3(p.surface));
    (u.uSurface2.value as Vector3).copy(vec3(p.surface2));
    (u.uF1.value as Vector3).copy(vec3(p.flame[0]));
    (u.uF2.value as Vector3).copy(vec3(p.flame[1]));
    (u.uF3.value as Vector3).copy(vec3(p.flame[2]));
    (u.uF4.value as Vector3).copy(vec3(p.flame[3]));
    this.nodeMaterial.color = new Color().setRGB(p.flame[0][0], p.flame[0][1], p.flame[0][2], SRGBColorSpace);
    this.applyBlending();
    this.requestRender();
  }

  /** Glow (additive) on dark backgrounds, ink-on-paper (normal) on light ones. */
  private applyBlending() {
    const blending = this.shared.uDark.value > 0.5 ? AdditiveBlending : NormalBlending;
    for (const m of this.additive) {
      if (m.blending !== blending) {
        m.blending = blending;
        m.needsUpdate = true;
      }
    }
  }

  /** Pointer position in normalised device coordinates (−1…1), or null when it left the window. */
  setPointer(x: number | null, y?: number) {
    if (x === null) {
      this.pointerActive = false;
      return;
    }
    this.pointerActive = true;
    this.pointer.set(x, y ?? 0);
    this.requestRender();
  }

  /** Emit a ripple from the point on the die floor under the pointer. */
  pulse() {
    if (!this.q.pointerFx) return;
    this.substrateU.uPulsePos.value.copy(this.pointerOnFloor());
    this.substrateU.uPulseAge.value = 0;
    this.requestRender();
  }

  /** Highlight the tile belonging to project `index` (null to clear). */
  setProjectHighlight(index: number | null) {
    this.hi = index === null ? -1 : (this.projectTiles[index] ?? -1);
    this.requestRender();
  }

  /** Brighten one memory ring (hovering a skills tier); null clears. */
  setRingHighlight(index: number | null) {
    this.ringHi = index ?? -1;
    this.requestRender();
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) this.requestRender();
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.applySize();
  }

  private applySize() {
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.particleU.uPixel.value = (this.height * this.dpr) / (2 * Math.tan((FOV * Math.PI) / 360));
    this.requestRender();
  }

  /** Begin the render loop (continuous, or on demand under reduced motion). */
  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    if (this.reduced) this.requestRender();
    else this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.scene.traverse((obj) => {
      const mesh = obj as Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ------------------------------------------------------------ frame loop

  private onLost = (e: Event) => {
    e.preventDefault();
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.onContextLost?.();
  };

  private onVisibility = () => {
    this.paused = document.hidden;
    if (!this.paused) {
      this.last = performance.now();
      this.requestRender();
    }
  };

  private loop = (now: number) => {
    if (this.disposed || !this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.paused) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.adapt(dt * 1000);
  };

  /** Reduced-motion mode: draw one frame whenever an input changes. */
  private requestRender() {
    if (!this.reduced || this.pendingRender || this.disposed || !this.running) return;
    this.pendingRender = true;
    requestAnimationFrame(() => {
      this.pendingRender = false;
      if (this.disposed || this.paused) return;
      this.update(0.016);
      this.renderer.render(this.scene, this.camera);
    });
  }

  private pointerOnFloor(): Vector2 {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const out = new Vector2(0, 0);
    if (this.raycaster.ray.intersectPlane(this.floor, this.hit)) out.set(this.hit.x, this.hit.z);
    return out;
  }

  private update(dt: number) {
    const reduced = this.reduced;
    if (!reduced) this.time += dt;
    this.shared.uTime.value = reduced ? 8 : this.time;

    // Damped flight toward the scroll target (instant when reduced).
    this.f = reduced ? this.targetF : this.f + (this.targetF - this.f) * (1 - Math.exp(-dt * 4.5));

    const pose = samplePath(this.poses, this.f);
    const look = vec3(pose.look);
    const pos = vec3(pose.pos);

    // Intro dolly: start far and high, settle as the reveal completes.
    const intro = smooth(this.reveal);
    pos.sub(look).multiplyScalar(1 + (1 - intro) * 0.7);
    pos.y += (1 - intro) * 9;

    // Portrait screens need more distance to frame the same scene.
    const aspect = this.width / this.height;
    if (aspect < 1) pos.multiplyScalar(1 + (1 - aspect) * 0.75);
    pos.add(look);

    if (this.q.pointerFx && !reduced) {
      const tx = this.pointerActive ? this.pointer.x : 0;
      const ty = this.pointerActive ? this.pointer.y : 0;
      const k = 1 - Math.exp(-dt * 3);
      this.parallax.x += (tx - this.parallax.x) * k;
      this.parallax.y += (ty - this.parallax.y) * k;
      pos.x += this.parallax.x * 2.4;
      pos.y += this.parallax.y * 1.2;
    }
    if (!reduced) {
      // A slow breathing orbit keeps the scene alive between scrolls.
      const a = Math.sin(this.time * 0.1) * 0.05;
      const dx = pos.x - look.x;
      const dz = pos.z - look.z;
      pos.x = look.x + dx * Math.cos(a) - dz * Math.sin(a);
      pos.z = look.z + dx * Math.sin(a) + dz * Math.cos(a);
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(look);

    // Section emphasis.
    const w = stationWeights(this.keys, this.f);
    this.shared.uStageProjects.value = w.projects ?? 0;
    this.shared.uOut.value = w.contact ?? 0;
    this.ringU.uWeight.value = w.skills ?? 0;
    this.pipeU.uWeight.value = w.experience ?? 0;
    this.nodeMaterial.opacity = 0.15 + 0.85 * (w.experience ?? 0);

    this.rings.forEach((ring, i) => {
      const target = i === this.ringHi ? 0.7 : 0;
      this.ringBoost[i] += (target - this.ringBoost[i]) * (reduced ? 1 : 1 - Math.exp(-dt * 10));
      ((ring.material as ShaderMaterial).uniforms.uBoost as IUniform).value = this.ringBoost[i];
    });

    // Highlight easing, pulse clock, pointer hover.
    const hiTarget = this.hi >= 0 ? 1 : 0;
    const hiAmt = this.tileU.uHiAmt.value as number;
    this.tileU.uHiAmt.value = reduced ? hiTarget : hiAmt + (hiTarget - hiAmt) * (1 - Math.exp(-dt * 10));
    if (this.hi >= 0) this.tileU.uHi.value = this.hi;
    else if ((this.tileU.uHiAmt.value as number) < 0.01) this.tileU.uHi.value = -1;

    if (this.q.pointerFx) {
      this.substrateU.uPulseAge.value = Math.min(99, (this.substrateU.uPulseAge.value as number) + dt);
      const floorPt = this.pointerOnFloor();
      (this.substrateU.uPointer.value as Vector2).copy(floorPt);
      const hover = this.pointerActive && !reduced ? 1 : 0;
      this.substrateU.uHover.value += (hover - (this.substrateU.uHover.value as number)) * (1 - Math.exp(-dt * 5));
    }
  }

  /** Step quality down if frames keep missing the budget (decision D6: auto-degrade). */
  private adapt(frameMs: number) {
    this.frames++;
    if (this.frames < 90) return; // let shaders compile and the intro run first
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > 90) this.frameTimes.shift();
    if (!shouldDegrade(this.frameTimes)) return;
    this.frameTimes = [];
    const next = lowerDpr(this.dpr);
    if (next !== null) {
      this.dpr = next;
      this.applySize();
    } else if (this.drawFraction > 0.3) {
      this.drawFraction *= 0.6;
      this.particles.geometry.setDrawRange(0, Math.floor(this.q.particles * this.drawFraction));
    }
  }
}
