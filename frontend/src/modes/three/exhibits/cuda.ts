/**
 * CUDA exhibit: a graphics card hanging in the air, and a descent from the
 * whole GPU down to a single thread.
 *
 *   level 0  GPU          card with shroud and spinning fans, GDDR chips, VRM; the fans dissolve
 *   level 1  grid of SMs  the die: 48 streaming multiprocessors with blocks being dealt out, shared L2
 *   level 2  one SM       four partitions (scheduler, register file, CUDA cores) over L1 / shared memory
 *   level 3  a warp       32 lanes in lockstep; a branch splits them and the halves take turns
 *   level 4  a thread     its registers, an FP32 and an INT32 ALU, and shared memory, with data in flight
 *
 * Same construction as the hardware exhibit (see hardware.ts): every level is
 * a 10 × 10 frame parented to what it magnifies and scaled to fit it.
 */
import { Color, Group, Matrix4, Vector3 } from "three";
import type { InstancedMesh } from "three";

import type { Palette } from "../scene/palette";
import { FALLBACK_PALETTE } from "../scene/palette";
import type { Vec3 } from "../scene/stations";
import { EXHIBITS, EXHIBIT_ORIGINS } from "./catalog";
import { levelWindow } from "./dive";
import type { FadeWindow } from "./dive";
import { Skin, alongPath, createFraming, mulberry32, scatter, segmentLengths, ticker, tones } from "./kit";
import type { Exhibit, ExhibitFrame } from "./types";

const LEVELS = EXHIBITS.cuda.levels.length;
const level = (k: number): FadeWindow => levelWindow(k, LEVELS);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (x: number) => x * x * (3 - 2 * x);
const gone: FadeWindow = [-9, -9, 0.25, 0.9]; // outer shells (shroud, package) that dissolve to reveal the next level

// Where each level's frame sits in the one above, and its scale.
const DIE_POS: Vec3 = [0, 0, 0.75];
const DIE_SCALE = 0.64; // 10 → the 6.4-wide die, on an 8-wide package
const SM_COLS = 8;
const SM_ROW_Y = [3.4, 2.2, 1.0, -1.0, -2.2, -3.4]; // three rows above the L2 slab, three below
const SM_PITCH = 1.2;
const SM_X = (c: number) => -4.2 + c * SM_PITCH;
const SM_CHOSEN = { col: 5, row: 1 }; // the SM we fly into
const SM_SCALE = 0.12; // 10 → one 1.2-wide SM tile
const WARP_AT: [number, number] = [2.3, 2.1]; // top-right partition of the SM, in SM units
const WARP_SCALE = 0.42; // 10 → the 4.2-wide partition
const LANE_COLS = 8;
const LANE_ROWS = 4;
const LANE_X = (c: number) => -4.375 + c * 1.25;
const LANE_Y = (r: number) => 2.1 - r * 1.4;
const LANE_CHOSEN = { col: 3, row: 1 };
const THREAD_SCALE = 0.1; // 10 → one 1-wide lane

/** Operand and result paths inside a thread (thread-frame units). */
const THREAD_LINKS: Vec3[][] = [
  [[-2.3, 2, 0.4], [-1.1, 2, 0.4]],
  [[-2.3, -1.6, 0.4], [-1.1, -1.6, 0.4]],
  [[0.4, 3.6, 0.4], [0.4, 4.4, 0.4], [-3.6, 4.4, 0.4], [-3.6, 4.1, 0.4]],
  [[3.6, 2, 0.4], [1.9, 2, 0.4]],
  [[3.6, -1.6, 0.4], [1.9, -1.6, 0.4]],
];
const TOKENS_PER_LINK = 2;

interface Animated {
  visible(): boolean;
  recolor?(p: Palette): void;
  update(t: number, reduced: boolean): void;
}

export function createCudaExhibit(): Exhibit {
  const skin = new Skin();
  const root = new Group();
  root.position.set(...EXHIBIT_ORIGINS.cuda);

  const die = new Group();
  die.position.set(...DIE_POS);
  die.scale.setScalar(DIE_SCALE);
  root.add(die);

  const sm = new Group();
  sm.position.set(SM_X(SM_CHOSEN.col), SM_ROW_Y[SM_CHOSEN.row], 0.35);
  sm.scale.setScalar(SM_SCALE);
  die.add(sm);

  const warp = new Group();
  warp.position.set(WARP_AT[0], WARP_AT[1], 0.3);
  warp.scale.setScalar(WARP_SCALE);
  sm.add(warp);

  const thread = new Group();
  thread.position.set(LANE_X(LANE_CHOSEN.col), LANE_Y(LANE_CHOSEN.row), 0.3);
  thread.scale.setScalar(THREAD_SCALE);
  warp.add(thread);

  const fans = buildCard(skin, root);
  const animated: Animated[] = [buildGrid(skin, die), buildSm(skin, sm), buildWarp(skin, warp), buildThread(skin, thread)];

  // The card is seen from a three-quarter angle, far enough back to show its cables; deeper levels are face-on.
  const framing = createFraming([root, die, sm, warp, thread], { pos: [9, 9, 42], look: [-3, 4, 0] });
  let palette: Palette | null = null;

  return {
    root,
    setPalette(p) {
      palette = p;
      skin.setPalette(p);
      for (const a of animated) a.recolor?.(p);
    },
    update({ time, depth, weight, reduced, aspect }: ExhibitFrame) {
      framing.setAspect(aspect);
      // The card sways on its cables; the sway dies away as the camera commits to the dive.
      const settle = 1 - smooth(clamp01(depth));
      const t = reduced ? 0 : time;
      root.rotation.set(0.05 + Math.sin(t * 0.27) * 0.03 * settle, -0.3 + Math.sin(t * 0.33) * 0.07 * settle, Math.sin(t * 0.29) * 0.02 * settle);
      fans.rotation(t);
      root.updateMatrixWorld(true);

      skin.update(depth, weight);
      if (weight > 0.004 && palette) for (const a of animated) if (a.visible()) a.update(t, reduced);
    },
    poseAt: framing.poseAt,
  };
}

// ------------------------------------------------------------ level 0: card

function buildCard(skin: Skin, root: Group) {
  const rand = mulberry32(31);
  const part = skin.part(root, level(0));

  part.box([24, 12, 0.4], [0, 0, 0], "surface", 0.9, 0.55, "ink");

  const traces: Vec3[] = [];
  for (let i = 0; i < 80; i++) {
    let x = (rand() - 0.5) * 22;
    let y = (rand() - 0.5) * 10.5;
    let horizontal = rand() > 0.5;
    for (let s = 0; s < 2 + Math.floor(rand() * 3); s++) {
      const len = (1 + rand() * 3.5) * (rand() > 0.5 ? 1 : -1);
      const nx = Math.max(-11.5, Math.min(11.5, horizontal ? x + len : x));
      const ny = Math.max(-5.5, Math.min(5.5, horizontal ? y : y + len));
      traces.push([x, y, 0.21], [nx, ny, 0.21]);
      x = nx;
      y = ny;
      horizontal = !horizontal;
    }
  }
  part.lines(traces, "muted", 0.3);

  // GDDR memory in two columns either side of the GPU, a row of VRM inductors, the PCIe fingers.
  for (const side of [-1, 1]) {
    for (const col of [7.0, 9.2]) {
      for (const y of [3.6, 0, -3.6]) part.box([1.8, 1.8, 0.3], [side * col, y, 0.35], "muted", 0.45, 0.65, "ink");
    }
  }
  const vrm: Vec3[] = [];
  for (let i = 0; i < 14; i++) vrm.push([-7.8 + i * 1.2, -5.0, 0.55]);
  part.boxes([0.8, 0.8, 0.5], vrm, "muted", 0.55);
  const fingers: Vec3[] = [];
  for (let i = 0; i < 36; i++) fingers.push([-6.1 + i * 0.35, -6.0, 0.21], [-6.1 + i * 0.35, -5.5, 0.21]);
  part.lines(fingers, "signal", 0.8);

  // Cables the card hangs from.
  part.lines(
    [
      [-10, 6, 0.2], [0, 13, 0.2],
      [10, 6, 0.2], [0, 13, 0.2],
      [0, 13, 0.2], [0, 14.4, 0.2],
    ],
    "ink",
    0.7,
  );
  const hook: Vec3[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const b = ((i + 1) / 24) * Math.PI * 2;
    hook.push([Math.cos(a) * 0.7, 15.1 + Math.sin(a) * 0.7, 0.2], [Math.cos(b) * 0.7, 15.1 + Math.sin(b) * 0.7, 0.2]);
  }
  part.lines(hook, "ink", 0.7);

  // The GPU package, then the cooler shroud on top of everything; both dissolve to reveal the die.
  const pkg = skin.part(root, gone);
  pkg.box([8, 8, 0.4], [0, 0, 0.4], "surface2", 0.95, 1, "signal");
  const shroud = skin.part(root, gone);
  shroud.box([23, 11.4, 0.9], [0, 0, 0.65], "surface", 0.85, 0.8, "ink");

  const spinners: Group[] = [];
  for (const x of [-5.8, 5.8]) {
    const g = new Group();
    g.position.set(x, 0, 1.12);
    root.add(g);
    const fan = skin.part(g, gone);
    const ring = (r: number, segs = 48): Vec3[] => {
      const pts: Vec3[] = [];
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const b = ((i + 1) / segs) * Math.PI * 2;
        pts.push([Math.cos(a) * r, Math.sin(a) * r, 0], [Math.cos(b) * r, Math.sin(b) * r, 0]);
      }
      return pts;
    };
    fan.lines([...ring(4.4), ...ring(0.9, 20)], "ink", 0.8);
    // Nine curved blades, each two segments from the hub to the rim.
    const blades: Vec3[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const at = (r: number, da: number): Vec3 => [Math.cos(a + da) * r, Math.sin(a + da) * r, 0];
      blades.push(at(0.9, 0), at(2.6, 0.28), at(2.6, 0.28), at(4.3, 0.55));
    }
    fan.lines(blades, "signal", 0.75);
    spinners.push(g);
  }
  return {
    rotation(t: number) {
      spinners.forEach((g, i) => (g.rotation.z = t * (i ? -2.6 : 2.6)));
    },
  };
}

// ------------------------------------------------------------ level 1: grid

function buildGrid(skin: Skin, die: Group): Animated {
  const slab = skin.part(die, [0.2, 0.75, 2.4, 3]);
  slab.box([10, 10, 0.55], [0, 0, 0], "surface2", 0.95, 0.9, "signal");

  const part = skin.part(die, level(1));
  const positions: Vec3[] = [];
  const index: number[][] = [];
  for (const y of SM_ROW_Y) {
    const row: number[] = [];
    for (let c = 0; c < SM_COLS; c++) {
      row.push(positions.length);
      positions.push([SM_X(c), y, 0.32]);
    }
    index.push(row);
  }
  const tiles: InstancedMesh = part.boxes([1.05, 1.0, 0.2], positions, "white", 0.95);
  const chosen = index[SM_CHOSEN.row][SM_CHOSEN.col];

  part.box([9.4, 0.8, 0.16], [0, 0, 0.34], "hot", 0.32, 1); // shared L2
  const bank: Vec3[] = [];
  for (let i = -4; i <= 4; i++) bank.push([i * 1.05, -0.4, 0.43], [i * 1.05, 0.4, 0.43]);
  part.lines(bank, "hot", 0.5);
  part.box([9.4, 0.4, 0.12], [0, 4.7, 0.34], "signal", 0.35, 0.9); // block scheduler
  part.box([9.4, 0.4, 0.12], [0, -4.7, 0.34], "muted", 0.4, 0.6, "ink"); // memory controllers
  part.box([1.2, 1.1, 0.3], [SM_X(SM_CHOSEN.col), SM_ROW_Y[SM_CHOSEN.row], 0.4], "signal", 0, 1);
  // Block dispatch lines from the scheduler to the SM we are about to enter.
  part.lines([[SM_X(SM_CHOSEN.col), 4.5, 0.4], [SM_X(SM_CHOSEN.col), SM_ROW_Y[SM_CHOSEN.row] + 0.55, 0.4]], "signal", 0.9);

  let colors = tones(skin.currentPalette ?? FALLBACK_PALETTE);
  let tick = 0;
  const next = ticker(5);
  const paint = () => {
    const c = new Color();
    for (let i = 0; i < positions.length; i++) {
      const busy = scatter(i, tick) < 0.55;
      tiles.setColorAt(i, i === chosen ? colors.signal : busy ? c.copy(colors.hot).multiplyScalar(0.55 + 0.45 * scatter(i, tick + 9)) : colors.idle);
    }
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
  };
  return {
    visible: () => part.group.visible,
    recolor(p) {
      colors = tones(p);
      paint();
    },
    update(t, reduced) {
      const k = next(reduced ? 0 : t);
      if (k === null) return;
      tick = k;
      paint();
    },
  };
}

// ------------------------------------------------------------- level 2: SM

function buildSm(skin: Skin, sm: Group): Animated {
  const part = skin.part(sm, level(2));
  part.box([10, 10, 0.2], [0, 0, 0], "surface", 0.7, 0.9, "ink");

  part.box([9, 0.6, 0.3], [0, 4.4, 0.2], "muted", 0.4, 0.7, "ink"); // instruction cache
  part.box([9, 1.5, 0.3], [0, -4.0, 0.2], "hot", 0.4, 0.9); // L1 / shared memory
  const shared: Vec3[] = [];
  for (let i = -4; i <= 4; i++) shared.push([i, -4.75, 0.37], [i, -3.25, 0.37]);
  part.lines(shared, "hot", 0.5);

  const quads: [number, number][] = [[-2.3, 2.1], [2.3, 2.1], [-2.3, -1.2], [2.3, -1.2]];
  const cores: Vec3[] = [];
  const chosenQuad = 1;
  quads.forEach(([qx, qy], q) => {
    const hot = q === chosenQuad;
    part.box([4.2, 3.3, 0.3], [qx, qy, 0.2], hot ? "signal" : "surface", hot ? 0.3 : 0.8, 0.85, hot ? "signal" : "ink");
    part.box([3.8, 0.5, 0.3], [qx, qy + 1.3, 0.35], "signal", 0.4, 0.9); // warp scheduler + dispatch
    part.box([1.0, 1.9, 0.3], [qx - 1.5, qy - 0.2, 0.35], "muted", 0.45, 0.7, "ink"); // register file
    part.box([0.7, 0.7, 0.3], [qx + 1.5, qy + 0.4, 0.35], "surface2", 0.8, 0.7, "ink"); // special function unit
    part.box([0.7, 0.7, 0.3], [qx + 1.5, qy - 0.5, 0.35], "surface2", 0.8, 0.7, "ink"); // load / store
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) cores.push([qx - 0.5 + c * 0.34, qy - 0.5 + r * 0.34, 0.42]);
  });
  const coreMesh: InstancedMesh = part.boxes([0.24, 0.24, 0.12], cores, "white", 0.95);

  let colors = tones(skin.currentPalette ?? FALLBACK_PALETTE);
  let tick = 0;
  const next = ticker(7);
  const paint = () => {
    for (let i = 0; i < cores.length; i++) {
      const q = Math.floor(i / 16);
      const lit = q === chosenQuad ? (i + tick) % 16 < 6 : scatter(i, tick) < 0.4;
      coreMesh.setColorAt(i, lit ? (q === chosenQuad ? colors.signal : colors.hot) : colors.idle);
    }
    if (coreMesh.instanceColor) coreMesh.instanceColor.needsUpdate = true;
  };
  return {
    visible: () => part.group.visible,
    recolor(p) {
      colors = tones(p);
      paint();
    },
    update(t, reduced) {
      const k = next(reduced ? 0 : t);
      if (k === null) return;
      tick = k;
      paint();
    },
  };
}

// ------------------------------------------------------------ level 3: warp

function buildWarp(skin: Skin, warp: Group): Animated {
  const part = skin.part(warp, level(3));
  part.box([10, 10, 0.2], [0, 0, 0], "surface", 0.7, 0.9, "ink");
  part.box([9, 0.7, 0.3], [0, 4.2, 0.2], "signal", 0.4, 0.9); // the one instruction every lane receives

  // Instruction broadcast: a line down to every lane column.
  const broadcast: Vec3[] = [];
  for (let c = 0; c < LANE_COLS; c++) broadcast.push([LANE_X(c), 3.85, 0.3], [LANE_X(c), LANE_Y(0) + 0.55, 0.3]);
  part.lines(broadcast, "signal", 0.6);

  const positions: Vec3[] = [];
  for (let r = 0; r < LANE_ROWS; r++) for (let c = 0; c < LANE_COLS; c++) positions.push([LANE_X(c), LANE_Y(r), 0.3]);
  const lanes: InstancedMesh = part.boxes([1.0, 1.0, 0.3], positions, "white", 0.95);
  part.box([1.25, 1.25, 0.4], [LANE_X(LANE_CHOSEN.col), LANE_Y(LANE_CHOSEN.row), 0.3], "signal", 0, 1);

  let colors = tones(skin.currentPalette ?? FALLBACK_PALETTE);
  let phase = -1;
  // 0 uniform, 1 the `if` half runs, 2 the `else` half runs, 3 reconverged.
  const paint = (p: number) => {
    phase = p;
    for (let i = 0; i < positions.length; i++) {
      const active = p === 1 ? i % 2 === 0 : p === 2 ? i % 2 === 1 : true;
      lanes.setColorAt(i, active ? colors.hot : colors.idle);
    }
    if (lanes.instanceColor) lanes.instanceColor.needsUpdate = true;
  };
  return {
    visible: () => part.group.visible,
    recolor(p) {
      colors = tones(p);
      paint(Math.max(phase, 0));
    },
    update(t, reduced) {
      const p = reduced ? 0 : Math.floor((t % 4.8) / 1.2);
      if (p !== phase) paint(p);
    },
  };
}

// ---------------------------------------------------------- level 4: thread

function buildThread(skin: Skin, thread: Group): Animated {
  const part = skin.part(thread, level(4));
  part.box([10, 10, 0.2], [0, 0, 0], "surface", 0.7, 0.9, "ink");

  const regPositions: Vec3[] = [];
  for (let i = 0; i < 16; i++) regPositions.push([-3.6, 3.9 - i * 0.52, 0.2]);
  const regs: InstancedMesh = part.boxes([2.6, 0.38, 0.14], regPositions, "white", 0.95);

  part.box([3, 3.2, 0.4], [0.4, 2, 0.3], "signal", 0.32, 1); // FP32 ALU
  part.box([3, 2.2, 0.4], [0.4, -1.6, 0.3], "surface", 0.85, 0.85, "ink"); // INT32 ALU
  part.box([1.4, 8, 0.3], [4.3, 0, 0.25], "hot", 0.4, 0.9); // shared memory
  // The fused multiply-add inside the FP32 unit, drawn as a ×  +  chain.
  part.lines(
    [
      [-0.6, 2.6, 0.52], [0.0, 2.0, 0.52], [-0.6, 2.0, 0.52], [0.0, 2.6, 0.52],
      [0.6, 2.3, 0.52], [1.4, 2.3, 0.52], [1.0, 1.9, 0.52], [1.0, 2.7, 0.52],
    ],
    "signal",
    0.9,
  );
  const wires: Vec3[] = [];
  for (const link of THREAD_LINKS) for (let i = 0; i + 1 < link.length; i++) wires.push(link[i], link[i + 1]);
  part.lines(wires, "signal", 0.7);

  const tokens = part.boxes([0.3, 0.3, 0.3], Array.from({ length: THREAD_LINKS.length * TOKENS_PER_LINK }, () => [0, 0, 0.55] as Vec3), "hot", 1);
  const lengths = THREAD_LINKS.map((l) => segmentLengths(l));
  const m = new Matrix4();
  const pt = new Vector3();

  let colors = tones(skin.currentPalette ?? FALLBACK_PALETTE);
  let lit = -1;
  const paint = (row: number) => {
    lit = row;
    for (let i = 0; i < 16; i++) regs.setColorAt(i, i === row ? colors.hot : colors.idle);
    if (regs.instanceColor) regs.instanceColor.needsUpdate = true;
  };
  return {
    visible: () => part.group.visible,
    recolor(p) {
      colors = tones(p);
      paint(Math.max(lit, 0));
    },
    update(t, reduced) {
      const row = reduced ? 0 : Math.floor(t * 3) % 16;
      if (row !== lit) paint(row);
      let n = 0;
      THREAD_LINKS.forEach((link, li) => {
        for (let k = 0; k < TOKENS_PER_LINK; k++) {
          const u = (t * 0.4 + k / TOKENS_PER_LINK + li * 0.17) % 1;
          alongPath(link, lengths[li], u, pt);
          tokens.setMatrixAt(n++, m.makeTranslation(pt.x, pt.y, pt.z));
        }
      });
      tokens.instanceMatrix.needsUpdate = true;
    },
  };
}
