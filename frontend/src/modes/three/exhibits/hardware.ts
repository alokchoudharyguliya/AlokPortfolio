/**
 * Hardware exhibit: a motherboard hanging in the air, and a descent through
 * every scale down to a register file.
 *
 *   level 0  motherboard   socket, DIMM slots, PCIe, VRM, chipset; swaying on its cables
 *   level 1  CPU package   substrate, contacts and decoupling caps under the heat spreader
 *   level 2  caches        the die floorplan: shared L3, per-core L2, eight cores
 *   level 3  a core        front end → out-of-order engine → execution units, with L1
 *   level 4  registers     16 × 64 bit cells, written one row at a time
 *
 * Each level is its own coordinate frame, a 10 × 10 unit square facing +z,
 * parented to the feature it magnifies in the level above and scaled to fit
 * it. The camera therefore always descends straight down a frame's z axis and
 * the geometry never needs huge or tiny numbers of its own. Cumulative scale
 * ends near 0.019, which is why Engine adjusts the near plane while diving.
 */
import { Color, Group, Matrix4, Vector3 } from "three";
import type { InstancedMesh } from "three";

import type { Vec3 } from "../scene/stations";
import type { Palette } from "../scene/palette";
import { EXHIBITS, EXHIBIT_ORIGINS } from "./catalog";
import { levelWindow } from "./dive";
import type { FadeWindow } from "./dive";
import { Skin, alongPath, createFraming, mulberry32, segmentLengths, tones } from "./kit";
import type { Exhibit, ExhibitFrame } from "./types";

const LEVELS = EXHIBITS.hardware.levels.length;
const level = (k: number): FadeWindow => levelWindow(k, LEVELS);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (x: number) => x * x * (3 - 2 * x);

// Where each level's frame sits inside the one above (position) and how much it shrinks (scale).
const SOCKET: Vec3 = [-2.5, 1.5, 0.72];
const PKG_SCALE = 0.46; // 10 local units → the 4.6-wide heat spreader
const DIE_POS: Vec3 = [0, 0, 0.425];
const DIE_SCALE = 0.64; // 10 → the 6.4-wide die, in package units
const CORE_AT: [number, number] = [1.2, 3.2]; // the core we dive into, in die units
const CORE_SCALE = 0.2; // 10 → a 2-wide core block
const RF_AT: [number, number] = [2.6, 1.2]; // the register file inside that core
const RF_SCALE = 0.32; // 10 → a 3.2-wide block

/** Execution-core dataflow links (core-frame coordinates) that carry the moving tokens. */
const LINKS: Vec3[][] = [
  [[-3.6, 0.6, 0.4], [-3.6, -0.1, 0.4]],
  [[-2.2, -0.8, 0.4], [-1.5, -0.8, 0.4], [-1.5, -0.2, 0.4]],
  [[1.1, 0.4, 0.4], [1.0, 0.7, 0.4]],
  [[-0.2, -1.6, 0.4], [-0.2, -1.8, 0.4]],
  [[-0.2, -3.0, 0.4], [-0.2, -3.4, 0.4], [-3.9, -3.4, 0.4]],
  [[-0.2, -3.0, 0.4], [-0.2, -3.4, 0.4], [3.9, -3.4, 0.4]],
  [[2.6, 0.2, 0.4], [2.6, -0.9, 0.4]],
  [[-3.3, 3.0, 0.4], [-3.3, 2.2, 0.4], [-3.6, 2.0, 0.4]],
];
const TOKENS_PER_LINK = 3;

export function createHardwareExhibit(): Exhibit {
  const skin = new Skin();
  const root = new Group();
  root.position.set(...EXHIBIT_ORIGINS.hardware);

  const pkg = new Group();
  pkg.position.set(...SOCKET);
  pkg.scale.setScalar(PKG_SCALE);
  root.add(pkg);

  const die = new Group();
  die.position.set(...DIE_POS);
  die.scale.setScalar(DIE_SCALE);
  pkg.add(die);

  const core = new Group();
  core.position.set(CORE_AT[0], CORE_AT[1], 0.35);
  core.scale.setScalar(CORE_SCALE);
  die.add(core);

  const rf = new Group();
  rf.position.set(RF_AT[0], RF_AT[1], 0.3);
  rf.scale.setScalar(RF_SCALE);
  core.add(rf);

  buildBoard(skin, root);
  buildPackage(skin, pkg);
  buildDie(skin, die);
  const flow = buildCore(skin, core);
  const regs = buildRegisters(skin, rf);

  // The board is seen from a three-quarter angle, far enough back to show its cables; deeper levels are face-on.
  const framing = createFraming([root, pkg, die, core, rf], { pos: [8, 8, 41], look: [-3, 4, 0] });

  return {
    root,
    setPalette(p) {
      skin.setPalette(p);
      regs.recolor(p);
    },
    update({ time, depth, weight, reduced, aspect }: ExhibitFrame) {
      framing.setAspect(aspect);
      // The board sways on its cables; the sway dies away as the camera commits to the dive.
      const settle = 1 - smooth(clamp01(depth));
      const t = reduced ? 0 : time;
      root.rotation.set(0.05 + Math.sin(t * 0.27) * 0.03 * settle, -0.32 + Math.sin(t * 0.35) * 0.07 * settle, Math.sin(t * 0.31) * 0.02 * settle);
      root.updateMatrixWorld(true);

      skin.update(depth, weight);
      if (weight > 0.004) {
        if (flow.visible()) flow.update(t);
        if (regs.visible()) regs.update(t, reduced);
      }
    },
    poseAt: framing.poseAt,
  };
}

// ------------------------------------------------------------ level 0: board

function buildBoard(skin: Skin, root: Group) {
  const rand = mulberry32(11);
  const part = skin.part(root, level(0));

  part.box([24, 18, 0.4], [0, 0, 0], "surface", 0.9, 0.55, "ink");

  // Copper traces: short orthogonal runs scattered over the board.
  const traces: Vec3[] = [];
  for (let i = 0; i < 90; i++) {
    let x = (rand() - 0.5) * 22;
    let y = (rand() - 0.5) * 16;
    let horizontal = rand() > 0.5;
    for (let s = 0; s < 2 + Math.floor(rand() * 3); s++) {
      const len = (1 + rand() * 3.5) * (rand() > 0.5 ? 1 : -1);
      const nx = Math.max(-11.5, Math.min(11.5, horizontal ? x + len : x));
      const ny = Math.max(-8.5, Math.min(8.5, horizontal ? y : y + len));
      traces.push([x, y, 0.21], [nx, ny, 0.21]);
      x = nx;
      y = ny;
      horizontal = !horizontal;
    }
  }
  part.lines(traces, "muted", 0.3);

  // CPU socket (the lid that sits in it is a separate part, so it can dissolve and reveal level 1).
  part.box([5.4, 5.4, 0.3], [-2.5, 1.5, 0.35], "surface2", 0.9, 0.7, "signal");

  // Memory: four DIMM slots, two populated.
  for (let i = 0; i < 4; i++) {
    const x = 5.2 + i * 1.1;
    part.box([0.45, 8, 0.5], [x, 2, 0.45], "muted", 0.4, 0.6, "ink");
    if (i % 2 === 0) part.box([0.2, 7.6, 1.3], [x, 2, 0.85], "signal", 0.22, 0.85);
  }

  // PCIe slots, chipset, rear I/O.
  part.box([11, 0.5, 0.5], [-3, -4.3, 0.45], "muted", 0.4, 0.6, "ink");
  part.box([11, 0.5, 0.5], [-3, -6.8, 0.45], "muted", 0.4, 0.6, "ink");
  part.box([2.6, 2.6, 0.3], [6, -3.2, 0.35], "surface2", 0.9, 0.6, "ink");
  part.box([1.6, 7, 2.2], [-10.6, -2.5, 1.3], "muted", 0.3, 0.7, "ink");

  // VRM inductors and capacitors.
  const inductors: Vec3[] = [];
  for (let i = 0; i < 8; i++) inductors.push([-8.4 + i * 1.1, 6.3, 0.55]);
  for (let i = 0; i < 5; i++) inductors.push([-8.4, 3.9 - i * 1.1, 0.55]);
  part.boxes([0.9, 0.9, 0.7], inductors, "muted", 0.55);
  const caps: Vec3[] = [];
  for (let i = 0; i < 16; i++) caps.push([-10.5 + i * 1.4, 8.2, 0.45]);
  part.boxes([0.5, 0.5, 0.5], caps, "signal", 0.45);

  // The cables the board hangs from.
  part.lines(
    [
      [-9, 9, 0.2], [0, 14.5, 0.2],
      [9, 9, 0.2], [0, 14.5, 0.2],
      [0, 14.5, 0.2], [0, 16, 0.2],
    ],
    "ink",
    0.7,
  );
  const hook: Vec3[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const b = ((i + 1) / 24) * Math.PI * 2;
    hook.push([Math.cos(a) * 0.7, 16.7 + Math.sin(a) * 0.7, 0.2], [Math.cos(b) * 0.7, 16.7 + Math.sin(b) * 0.7, 0.2]);
  }
  part.lines(hook, "ink", 0.7);

  // The heat spreader: opaque at first, then it dissolves into the package below.
  const lid = skin.part(root, [-9, -9, 0.25, 0.9]);
  lid.box([4.6, 4.6, 0.45], [SOCKET[0], SOCKET[1], SOCKET[2]], "surface2", 0.95, 1, "signal");
}

// --------------------------------------------------------- level 1: package

function buildPackage(skin: Skin, pkg: Group) {
  const rand = mulberry32(23);
  const part = skin.part(pkg, level(1));

  part.box([10, 10, 0.5], [0, 0, 0], "surface", 0.92, 0.7, "ink");

  // Contact lands in a ring around the die, and decoupling capacitors between them.
  const lands: Vec3[] = [];
  for (let ix = 0; ix < 20; ix++) {
    for (let iy = 0; iy < 20; iy++) {
      const x = -4.5 + ix * 0.474;
      const y = -4.5 + iy * 0.474;
      if (Math.abs(x) < 3.6 && Math.abs(y) < 3.6) continue;
      lands.push([x, y, 0.27]);
    }
  }
  part.boxes([0.16, 0.16, 0.06], lands, "signal", 0.7);

  const caps: Vec3[] = [];
  for (let i = 0; i < 28; i++) {
    const side = Math.floor(rand() * 4);
    const along = (rand() - 0.5) * 6.6;
    const off = 3.75 + rand() * 0.2;
    caps.push(side === 0 ? [along, off, 0.32] : side === 1 ? [along, -off, 0.32] : side === 2 ? [off, along, 0.32] : [-off, along, 0.32]);
  }
  part.boxes([0.55, 0.28, 0.22], caps, "muted", 0.7);

  // Pin-1 marker.
  part.lines(
    [
      [-4.6, 4.6, 0.26], [-3.8, 4.6, 0.26], [-3.8, 4.6, 0.26], [-4.6, 3.8, 0.26], [-4.6, 3.8, 0.26], [-4.6, 4.6, 0.26],
    ],
    "signal",
    0.9,
  );
}

// ------------------------------------------------------------ level 2: die

function buildDie(skin: Skin, die: Group) {
  // The silicon itself is visible for levels 1–2 and stays out of the way afterwards.
  const slab = skin.part(die, [0.2, 0.75, 2.4, 3]);
  slab.box([10, 10, 0.55], [0, 0, 0], "surface2", 0.95, 0.9, "signal");

  const part = skin.part(die, level(2));
  const columns = [-3.6, -1.2, 1.2, 3.6];
  const rows = [3.2, -3.2];
  for (const cy of rows) {
    for (const cx of columns) {
      const chosen = cx === CORE_AT[0] && cy === CORE_AT[1];
      part.box([2, 2, 0.15], [cx, cy, 0.35], chosen ? "signal" : "surface", chosen ? 0.4 : 0.9, chosen ? 1 : 0.7, chosen ? "signal" : "ink");
      // Each core's private L2 slice hugs the edge facing the shared L3.
      const dir = cy > 0 ? -1 : 1;
      part.box([1.6, 0.5, 0.12], [cx, cy + dir * 0.62, 0.43], "hot", 0.5, 0.9);
    }
  }

  // Shared L3: one wide slab with its bank structure showing.
  part.box([9, 2.4, 0.18], [0, 0, 0.36], "hot", 0.32, 1);
  const stripes: Vec3[] = [];
  for (let i = -4; i <= 4; i++) stripes.push([i, -1.2, 0.46], [i, 1.2, 0.46]);
  stripes.push([-4.5, 0, 0.46], [4.5, 0, 0.46]);
  part.lines(stripes, "hot", 0.55);

  // Memory controller / I/O strips.
  part.box([9.6, 0.5, 0.12], [0, 4.7, 0.34], "muted", 0.4, 0.6, "ink");
  part.box([9.6, 0.5, 0.12], [0, -4.7, 0.34], "muted", 0.4, 0.6, "ink");

  // Links from the shared cache to the core we are about to enter.
  part.lines([[CORE_AT[0], 1.2, 0.46], [CORE_AT[0], CORE_AT[1] - 1.0, 0.46]], "signal", 0.9);
}

// ----------------------------------------------------------- level 3: core

interface Animated {
  visible(): boolean;
}

interface Flow extends Animated {
  update(t: number): void;
}

function buildCore(skin: Skin, core: Group): Flow {
  const part = skin.part(core, level(3));

  part.box([10, 10, 0.2], [0, 0, 0], "surface", 0.7, 0.9, "ink");
  const block = (w: number, h: number, x: number, y: number, role: "surface" | "hot" | "signal" | "surface2" = "surface") =>
    part.box([w, h, 0.3], [x, y, 0.2], role, role === "surface" ? 0.9 : 0.4, 0.85, role === "surface" || role === "surface2" ? "ink" : role);

  block(3.2, 1.6, -3.3, 3.8, "hot"); // L1 instruction cache
  block(3.2, 1.6, 3.3, 3.8, "hot"); // L1 data cache
  block(2.8, 1.4, -3.6, 1.3); // fetch
  block(2.8, 1.4, -3.6, -0.8); // decode
  block(2.6, 3.6, -0.2, 0.2); // rename / reorder buffer
  block(2.6, 1.2, -0.2, -2.4); // scheduler
  block(3.2, 2, RF_AT[0], RF_AT[1], "signal"); // register file: where we are going
  for (let i = 0; i < 4; i++) block(1.5, 1.2, -3.9 + i * 2.6, -4, "surface2"); // ALUs
  block(3.4, 1.4, 2.8, -1.6, "surface2"); // FPU / vector unit

  // Dataflow between the stages, and tokens that travel along it.
  const wires: Vec3[] = [];
  for (const link of LINKS) for (let i = 0; i + 1 < link.length; i++) wires.push(link[i], link[i + 1]);
  part.lines(wires, "signal", 0.7);

  const total = LINKS.length * TOKENS_PER_LINK;
  const tokens = part.boxes([0.28, 0.28, 0.28], Array.from({ length: total }, () => [0, 0, 0.45] as Vec3), "hot", 1);
  const lengths = LINKS.map((link) => segmentLengths(link));
  const m = new Matrix4();
  const pt = new Vector3();

  return {
    visible: () => part.group.visible,
    update(t) {
      let n = 0;
      LINKS.forEach((link, li) => {
        for (let k = 0; k < TOKENS_PER_LINK; k++) {
          const u = (t * 0.35 + k / TOKENS_PER_LINK + li * 0.13) % 1;
          alongPath(link, lengths[li], u, pt);
          tokens.setMatrixAt(n++, m.makeTranslation(pt.x, pt.y, pt.z));
        }
      });
      tokens.instanceMatrix.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------- level 4: registers

const REG_ROWS = 16;
const REG_COLS = 64;
const CELL_W = 10 / REG_COLS;
const CELL_H = 6.25 / REG_ROWS;

interface RegisterFile extends Animated {
  recolor(p: Palette): void;
  update(t: number, reduced: boolean): void;
}

function buildRegisters(skin: Skin, rf: Group): RegisterFile {
  const rand = mulberry32(47);
  const part = skin.part(rf, level(4));

  part.box([10.3, 6.55, 0.1], [0, 0, -0.1], "surface", 0.85, 0.9, "ink");

  const positions: Vec3[] = [];
  for (let r = 0; r < REG_ROWS; r++) {
    for (let c = 0; c < REG_COLS; c++) {
      positions.push([-5 + CELL_W * (c + 0.5), 3.125 - CELL_H * (r + 0.5), 0.03]);
    }
  }
  const cells: InstancedMesh = part.boxes([CELL_W * 0.78, CELL_H * 0.72, 0.06], positions, "white", 0.95);
  const bits = new Uint8Array(REG_ROWS * REG_COLS);
  for (let i = 0; i < bits.length; i++) bits[i] = rand() > 0.5 ? 1 : 0;

  // Byte separators: thin lines every eight bits.
  const seps: Vec3[] = [];
  for (let b = 1; b < 8; b++) seps.push([-5 + b * 8 * CELL_W, 3.2, 0.08], [-5 + b * 8 * CELL_W, -3.2, 0.08]);
  part.lines(seps, "muted", 0.5);

  // A marker for the row currently being written.
  const cursor = part.box([10.1, CELL_H * 0.95, 0.06], [0, 0, 0.1], "hot", 0, 1);

  let on = new Color();
  let off = new Color();
  let hotOn = new Color();
  let hotOff = new Color();
  let activeRow = -1;
  let lastRow = -2;

  const paintRow = (r: number, hot: boolean) => {
    for (let c = 0; c < REG_COLS; c++) {
      const i = r * REG_COLS + c;
      cells.setColorAt(i, bits[i] ? (hot ? hotOn : on) : hot ? hotOff : off);
    }
  };
  const paintAll = () => {
    for (let r = 0; r < REG_ROWS; r++) paintRow(r, r === activeRow);
    if (cells.instanceColor) cells.instanceColor.needsUpdate = true;
  };

  return {
    visible: () => part.group.visible,
    recolor(p) {
      const t = tones(p);
      on = t.signal;
      hotOn = t.hot;
      off = t.idle;
      hotOff = t.idleLit;
      paintAll();
    },
    update(t, reduced) {
      // One register is written about every 0.6 s: its bits are replaced and its row lights up.
      const row = reduced ? 0 : Math.floor(t * 1.6) % REG_ROWS;
      if (row === lastRow) return;
      lastRow = row;
      if (!reduced) for (let c = 0; c < REG_COLS; c++) bits[row * REG_COLS + c] = rand() > 0.5 ? 1 : 0;
      activeRow = row;
      cursor.position.y = 3.125 - CELL_H * (row + 0.5);
      paintAll();
    },
  };
}
