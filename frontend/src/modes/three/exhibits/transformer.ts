/**
 * Transformer exhibit: the full encoder–decoder stack, and a tour through its
 * parts, in the order data meets them.
 *
 *   level 0  the stack      6 encoder layers, 6 decoder layers, the cross-attention bus; tokens flow up
 *   level 1  embeddings     tokens → vectors, plus a sinusoidal positional encoding
 *   level 2  attention      Q / K / V, eight heads, the softmax attention matrix, concat
 *   level 3  masked         the decoder's causal mask, one generation step at a time; cross-attention below
 *   level 4  output         feed-forward network, linear layer, softmax over the vocabulary
 *
 * Unlike the hardware and CUDA exhibits the levels are not nested: each is a
 * frame placed on the part of the stack it magnifies (encoder bottom, an
 * encoder layer, a decoder layer, the decoder top), so the camera travels
 * across the model rather than only inward.
 */
import { Color, Group, Matrix4, Quaternion, Vector3 } from "three";
import type { InstancedMesh } from "three";

import { FALLBACK_PALETTE } from "../scene/palette";
import type { Palette } from "../scene/palette";
import type { Vec3 } from "../scene/stations";
import { EXHIBITS, EXHIBIT_ORIGINS } from "./catalog";
import { levelWindow } from "./dive";
import type { FadeWindow } from "./dive";
import { Skin, alongPath, boxEdges, createFraming, scatter, segmentLengths, ticker, tones } from "./kit";
import type { Exhibit, ExhibitFrame } from "./types";

const LEVELS = EXHIBITS.transformer.levels.length;
const level = (k: number): FadeWindow => levelWindow(k, LEVELS);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (x: number) => x * x * (3 - 2 * x);

const ENC_X = -7;
const DEC_X = 7;
const LAYERS = 6;
const layerY = (i: number) => -5 + i * 2;
const CHOSEN = 2; // the layer we dive into, in both towers
const FRAME_SCALE = 0.6; // 10 → a 6-wide tower
const FRAME_Z = 1.0;
const TOKENS = 6;

/** Paths data takes through the stack (root units). */
const FLOWS: Vec3[][] = [
  [[ENC_X, -7.2, 0.9], [ENC_X, 6.4, 0.9]], // up the encoder
  [[ENC_X, 6.4, 0.9], [0, 6.4, 0.9], [0, -5.2, 0.9]], // encoder output onto the cross-attention bus
  [[DEC_X, -7.2, 0.9], [DEC_X, 6.4, 0.9]], // up the decoder
];
const FLOW_TOKENS = 4;

interface Animated {
  visible(): boolean;
  recolor?(p: Palette): void;
  update(t: number, reduced: boolean): void;
}

export function createTransformerExhibit(): Exhibit {
  const skin = new Skin();
  const root = new Group();
  root.position.set(...EXHIBIT_ORIGINS.transformer);

  const frame = (x: number, y: number) => {
    const g = new Group();
    g.position.set(x, y, FRAME_Z);
    g.scale.setScalar(FRAME_SCALE);
    root.add(g);
    return g;
  };
  const embedding = frame(ENC_X, -7.2);
  const attention = frame(ENC_X, layerY(CHOSEN));
  const masked = frame(DEC_X, layerY(CHOSEN));
  const output = frame(DEC_X, 6.5);

  const animated: Animated[] = [
    buildStack(skin, root),
    buildEmbedding(skin, embedding),
    buildAttention(skin, attention),
    buildMasked(skin, masked),
    buildOutput(skin, output),
  ];

  // Seen from a three-quarter angle, far enough back for both towers; deeper levels are face-on.
  const framing = createFraming([root, embedding, attention, masked, output], { pos: [8, 6, 40], look: [-3, 0, 0] });
  let ready = false;

  return {
    root,
    setPalette(p) {
      skin.setPalette(p);
      for (const a of animated) a.recolor?.(p);
      ready = true;
    },
    update({ time, depth, weight, reduced, aspect }: ExhibitFrame) {
      framing.setAspect(aspect);
      // A slow drift while the whole stack is in view; it settles as the camera commits to the dive.
      const settle = 1 - smooth(clamp01(depth));
      const t = reduced ? 0 : time;
      root.rotation.set(Math.sin(t * 0.27) * 0.02 * settle, -0.25 + Math.sin(t * 0.33) * 0.06 * settle, 0);
      root.updateMatrixWorld(true);

      skin.update(depth, weight);
      if (weight > 0.004 && ready) for (const a of animated) if (a.visible()) a.update(t, reduced);
    },
    poseAt: framing.poseAt,
  };
}

// ------------------------------------------------------------ level 0: stack

function buildStack(skin: Skin, root: Group): Animated {
  const part = skin.part(root, level(0));

  const encAttn: Vec3[] = [];
  const encFfn: Vec3[] = [];
  const decMasked: Vec3[] = [];
  const decCross: Vec3[] = [];
  const decFfn: Vec3[] = [];
  const outlines: Vec3[] = [];
  const links: Vec3[] = [];
  for (let i = 0; i < LAYERS; i++) {
    const y = layerY(i);
    encAttn.push([ENC_X - 1.2, y, 0]);
    encFfn.push([ENC_X + 1.8, y, 0]);
    decMasked.push([DEC_X - 2.05, y, 0]);
    decCross.push([DEC_X, y, 0]);
    decFfn.push([DEC_X + 2.05, y, 0]);
    for (const x of [ENC_X, DEC_X]) {
      outlines.push(...boxEdges([6, 1.6, 1.4], [x, y, 0]));
      if (i < LAYERS - 1) links.push([x, y + 0.8, 0.2], [x, y + 1.2, 0.2]);
    }
  }
  part.boxes([3.2, 1.2, 1.2], encAttn, "hot", 0.42);
  part.boxes([2.0, 1.2, 1.2], encFfn, "signal", 0.35);
  part.boxes([1.7, 1.2, 1.2], decMasked, "hot", 0.42);
  part.boxes([1.7, 1.2, 1.2], decCross, "muted", 0.55);
  part.boxes([1.7, 1.2, 1.2], decFfn, "signal", 0.35);
  part.lines(outlines, "ink", 0.6);
  part.lines(links, "muted", 0.7);

  // The layer we will enter in each tower.
  part.lines([...boxEdges([6.4, 1.95, 1.6], [ENC_X, layerY(CHOSEN), 0]), ...boxEdges([6.4, 1.95, 1.6], [DEC_X, layerY(CHOSEN), 0])], "signal", 1);

  // Embedding blocks under both towers, the output head over the decoder.
  part.box([6, 1.2, 1.2], [ENC_X, -7.2, 0], "hot", 0.5, 0.9);
  part.box([6, 1.2, 1.2], [DEC_X, -7.2, 0], "hot", 0.5, 0.9);
  part.box([6, 1.4, 1.2], [DEC_X, 7.2, 0], "signal", 0.5, 0.9);
  part.lines(
    [
      [ENC_X, -6.6, 0.2], [ENC_X, -5.8, 0.2],
      [DEC_X, -6.6, 0.2], [DEC_X, -5.8, 0.2],
      [DEC_X, 5.8, 0.2], [DEC_X, 6.5, 0.2],
    ],
    "muted",
    0.7,
  );

  // The cross-attention bus: encoder output runs down the middle and feeds every decoder layer.
  const bus: Vec3[] = [[ENC_X + 3, 6.4, 0.5], [0, 6.4, 0.5], [0, 6.4, 0.5], [0, -5, 0.5]];
  for (let i = 0; i < LAYERS; i++) bus.push([0, layerY(i), 0.5], [DEC_X - 3, layerY(i), 0.5]);
  part.lines(bus, "signal", 0.7);

  const total = FLOWS.length * FLOW_TOKENS;
  const tokens = part.boxes([0.4, 0.4, 0.4], Array.from({ length: total }, () => [0, 0, 0.9] as Vec3), "hot", 1);
  const lengths = FLOWS.map((f) => segmentLengths(f));
  const m = new Matrix4();
  const pt = new Vector3();
  return {
    visible: () => part.group.visible,
    update(t) {
      let n = 0;
      FLOWS.forEach((flow, fi) => {
        for (let k = 0; k < FLOW_TOKENS; k++) {
          const u = (t * 0.12 + k / FLOW_TOKENS + fi * 0.21) % 1;
          alongPath(flow, lengths[fi], u, pt);
          tokens.setMatrixAt(n++, m.makeTranslation(pt.x, pt.y, pt.z));
        }
      });
      tokens.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------- level 1: embeddings

function buildEmbedding(skin: Skin, frame: Group): Animated {
  const part = skin.part(frame, level(1));
  part.box([10, 10, 0.2], [0, 0, 0], "surface", 0.7, 0.9, "ink");

  const colX = (i: number) => -3.75 + i * 1.5;
  // Tokens along the top, each pointing at its embedding vector.
  for (let i = 0; i < TOKENS; i++) part.box([1.2, 0.8, 0.3], [colX(i), 4.1, 0.2], "hot", 0.5, 0.9);
  const down: Vec3[] = [];
  for (let i = 0; i < TOKENS; i++) down.push([colX(i), 3.6, 0.3], [colX(i), 3.05, 0.3]);
  part.lines(down, "muted", 0.8);

  const cells: Vec3[] = [];
  for (let i = 0; i < TOKENS; i++) for (let r = 0; r < 8; r++) cells.push([colX(i), 2.7 - r * 0.42, 0.2]);
  const matrix: InstancedMesh = part.boxes([1.0, 0.32, 0.12], cells, "white", 0.95);

  // The positional encoding: sines of rising frequency, sampled at each token's position.
  const waves: Vec3[] = [];
  const markers: Vec3[] = [];
  for (let k = 0; k < 4; k++) {
    const freq = 1 + k * 1.2;
    const y0 = -2.0 - k * 0.0;
    let prev: Vec3 | null = null;
    for (let s = 0; s <= 60; s++) {
      const x = -4.5 + (9 * s) / 60;
      const p: Vec3 = [x, y0 + Math.sin(((x + 4.5) / 9) * Math.PI * 2 * freq) * 0.55, 0.2];
      if (prev) waves.push(prev, p);
      prev = p;
    }
    for (let i = 0; i < TOKENS; i++) {
      const x = colX(i);
      markers.push([x, y0 + Math.sin(((x + 4.5) / 9) * Math.PI * 2 * freq) * 0.55, 0.25]);
    }
  }
  part.lines(waves, "signal", 0.55);
  part.boxes([0.2, 0.2, 0.2], markers, "signal", 0.95);

  // Add, then hand the sum on to the first layer.
  part.lines([[-4.8, 0.5, 0.3], [-4.2, 0.5, 0.3], [-4.5, 0.2, 0.3], [-4.5, 0.8, 0.3]], "ink", 0.9);
  part.lines([[-3.9, -3.3, 0.3], [3.9, -3.3, 0.3]], "muted", 0.6);
  const sums: Vec3[] = [];
  for (let i = 0; i < TOKENS; i++) sums.push([colX(i), -4.1, 0.2]);
  part.boxes([1.2, 0.55, 0.3], sums, "signal", 0.6);

  let colors = tones(skin.currentPalette ?? FALLBACK_PALETTE);
  let tick = 0;
  const next = ticker(1);
  const c = new Color();
  const paint = () => {
    for (let i = 0; i < cells.length; i++) matrix.setColorAt(i, c.copy(colors.idle).lerp(colors.hot, scatter(i, tick)));
    if (matrix.instanceColor) matrix.instanceColor.needsUpdate = true;
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

// ------------------------------------------------------- level 2: attention

const ATTN_LINKS: Vec3[][] = [
  [[-3.2, -4.05, 0.4], [-3.2, -3.25, 0.4]],
  [[0, -4.05, 0.4], [0, -3.25, 0.4]],
  [[3.2, -4.05, 0.4], [3.2, -3.25, 0.4]],
  [[0, 0.1, 0.4], [0, 0.4, 0.4]],
  [[0, 3.6, 0.4], [0, 4.0, 0.4]],
];

function buildAttention(skin: Skin, frame: Group): Animated {
  const part = skin.part(frame, level(2));
  part.box([10, 10, 0.2], [0, 0, 0], "surface", 0.7, 0.9, "ink");

  part.box([6, 0.7, 0.3], [0, -4.4, 0.2], "muted", 0.45, 0.8, "ink"); // the layer's input
  part.box([2.4, 0.9, 0.3], [-3.2, -2.8, 0.2], "hot", 0.5, 0.9); // Q
  part.box([2.4, 0.9, 0.3], [0, -2.8, 0.2], "signal", 0.45, 0.9); // K
  part.box([2.4, 0.9, 0.3], [3.2, -2.8, 0.2], "muted", 0.6, 0.9, "ink"); // V
  part.lines(
    [
      [-3.2, -2.35, 0.3], [-3.2, -1.5, 0.3],
      [0, -2.35, 0.3], [0, -1.5, 0.3],
      [3.2, -2.35, 0.3], [3.2, -1.5, 0.3],
      [-3.85, -1.5, 0.3], [3.85, -1.5, 0.3],
    ],
    "muted",
    0.6,
  );

  // Eight heads working side by side; one is lit at a time.
  const heads: Vec3[] = [];
  for (let h = 0; h < 8; h++) heads.push([-3.85 + h * 1.1, -0.6, 0.2]);
  const headMesh: InstancedMesh = part.boxes([0.9, 1.4, 0.3], heads, "white", 0.95);

  // The attention weights: one row per query, softmaxed over the keys.
  const cells: Vec3[] = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) cells.push([(j - 2.5) * 0.5, 1.9 - (i - 2.5) * 0.5, 0.2]);
  const matrix: InstancedMesh = part.boxes([0.42, 0.42, 0.14], cells, "white", 0.95);
  part.box([3.4, 3.4, 0.2], [0, 1.9, 0.05], "surface2", 0.6, 0.7, "signal");

  part.box([6, 0.8, 0.3], [0, 4.4, 0.2], "hot", 0.45, 0.9); // concat + output projection

  const wires: Vec3[] = [];
  for (const l of ATTN_LINKS) for (let i = 0; i + 1 < l.length; i++) wires.push(l[i], l[i + 1]);
  part.lines(wires, "signal", 0.75);
  const tokens = part.boxes([0.28, 0.28, 0.28], Array.from({ length: ATTN_LINKS.length * 2 }, () => [0, 0, 0.5] as Vec3), "hot", 1);
  const lengths = ATTN_LINKS.map((l) => segmentLengths(l));
  const m = new Matrix4();
  const pt = new Vector3();

  let colors = tones(skin.currentPalette ?? FALLBACK_PALETTE);
  let tick = 0;
  let lit = 0;
  const next = ticker(2);
  const c = new Color();
  const paint = () => {
    for (let h = 0; h < 8; h++) headMesh.setColorAt(h, h === lit ? colors.signal : colors.idle);
    if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;
    // Row-normalised weights: a few strong links per query, as softmax produces.
    for (let i = 0; i < 6; i++) {
      const raw = Array.from({ length: 6 }, (_, j) => Math.exp(3 * scatter(i * 6 + j, tick)));
      const sum = raw.reduce((a, b) => a + b, 0);
      for (let j = 0; j < 6; j++) matrix.setColorAt(i * 6 + j, c.copy(colors.idle).lerp(colors.hot, Math.min(1, (raw[j] / sum) * 3)));
    }
    if (matrix.instanceColor) matrix.instanceColor.needsUpdate = true;
  };
  return {
    visible: () => part.group.visible,
    recolor(p) {
      colors = tones(p);
      paint();
    },
    update(t, reduced) {
      const k = next(reduced ? 0 : t);
      if (k !== null) {
        tick = k;
        lit = reduced ? 0 : Math.floor(t * 2) % 8;
        paint();
      }
      let n = 0;
      ATTN_LINKS.forEach((l, li) => {
        for (let q = 0; q < 2; q++) {
          alongPath(l, lengths[li], (t * 0.5 + q / 2 + li * 0.19) % 1, pt);
          tokens.setMatrixAt(n++, m.makeTranslation(pt.x, pt.y, pt.z));
        }
      });
      tokens.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------- level 3: masked

const MASK_AT: [number, number] = [0.4, 0.5];
const maskX = (j: number) => MASK_AT[0] + (j - 2.5) * 0.9;
const maskY = (i: number) => MASK_AT[1] - (i - 2.5) * 0.9;

function buildMasked(skin: Skin, frame: Group): Animated {
  const part = skin.part(frame, level(3));
  part.box([10, 10, 0.2], [0, 0, 0], "surface", 0.7, 0.9, "ink");

  // Keys along the top, queries down the left: the tokens generated so far.
  for (let j = 0; j < 6; j++) part.box([0.78, 0.5, 0.3], [maskX(j), 3.95, 0.2], "signal", 0.45, 0.85);
  for (let i = 0; i < 6; i++) part.box([0.9, 0.78, 0.3], [-2.9, maskY(i), 0.2], "hot", 0.45, 0.85);

  const cells: Vec3[] = [];
  const crosses: Vec3[] = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      cells.push([maskX(j), maskY(i), 0.2]);
      if (j > i) {
        // Future positions: struck out.
        const [x, y] = [maskX(j), maskY(i)];
        crosses.push([x - 0.25, y - 0.25, 0.3], [x + 0.25, y + 0.25, 0.3], [x - 0.25, y + 0.25, 0.3], [x + 0.25, y - 0.25, 0.3]);
      }
    }
  }
  const grid: InstancedMesh = part.boxes([0.78, 0.78, 0.14], cells, "white", 0.95);
  part.lines(crosses, "ink", 0.55);

  // Cross-attention, fed by the encoder's output from the right.
  part.box([6.4, 0.9, 0.3], [-0.8, -3.7, 0.2], "muted", 0.55, 0.9, "ink");
  part.box([1.6, 1.2, 0.3], [4.2, -3.7, 0.2], "signal", 0.45, 0.9);
  part.lines([[3.4, -3.7, 0.3], [2.4, -3.7, 0.3], [-0.8, -2.5, 0.3], [-0.8, -3.25, 0.3]], "signal", 0.8);

  let colors = tones(skin.currentPalette ?? FALLBACK_PALETTE);
  let row = 0;
  const c = new Color();
  const paint = () => {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const allowed = j <= i;
        const color = i === row ? (allowed ? colors.hot : colors.idleLit) : allowed ? c.copy(colors.idle).lerp(colors.hot, 0.45) : colors.idle;
        grid.setColorAt(i * 6 + j, color);
      }
    }
    if (grid.instanceColor) grid.instanceColor.needsUpdate = true;
  };
  return {
    visible: () => part.group.visible,
    recolor(p) {
      colors = tones(p);
      paint();
    },
    update(t, reduced) {
      // One generation step per ~0.8 s: the row for the token being produced lights up.
      const r = reduced ? 3 : Math.floor(t * 1.25) % 6;
      if (r === row && grid.instanceColor) return;
      row = r;
      paint();
    },
  };
}

// ------------------------------------------------------------ level 4: output

const IDENTITY = new Quaternion();
const VOCAB = 16;
const BASE_Y = -4.6;
const BAR_X = (i: number) => -4.2 + i * 0.56;

function buildOutput(skin: Skin, frame: Group): Animated {
  const part = skin.part(frame, level(4));
  part.box([10, 10, 0.2], [0, 0, 0], "surface", 0.7, 0.9, "ink");

  // The feed-forward network: 5 → 9 → 5 nodes, fully connected.
  const layers = [
    { x: -3.6, n: 5, y0: 2.6, dy: 0.5 },
    { x: 0, n: 9, y0: 2.4, dy: 0.3 },
    { x: 3.6, n: 5, y0: 2.6, dy: 0.5 },
  ];
  const nodes: Vec3[] = [];
  const synapses: Vec3[] = [];
  const at = (l: (typeof layers)[number], k: number): Vec3 => [l.x, l.y0 + k * l.dy, 0.2];
  layers.forEach((l, li) => {
    for (let k = 0; k < l.n; k++) {
      nodes.push(at(l, k));
      const next = layers[li + 1];
      if (next) for (let q = 0; q < next.n; q++) synapses.push(at(l, k), at(next, q));
    }
  });
  part.lines(synapses, "muted", 0.28);
  const nodeMesh: InstancedMesh = part.boxes([0.24, 0.24, 0.14], nodes, "white", 0.95);

  part.box([8.6, 0.25, 0.2], [0, 1.65, 0.2], "ink", 0.5, 0.7); // add & norm
  part.box([8.6, 0.9, 0.3], [0, 0.7, 0.2], "hot", 0.45, 0.9); // linear projection to vocabulary size
  part.lines([[0, 1.55, 0.3], [0, 1.2, 0.3], [0, 0.25, 0.3], [0, -0.2, 0.3]], "muted", 0.7);
  part.lines([[-4.5, BASE_Y, 0.25], [4.5, BASE_Y, 0.25]], "ink", 0.7);

  // Softmax over the vocabulary: bars whose heights are probabilities; the tallest is the next token.
  const bars: InstancedMesh = part.boxes(
    [0.4, 1, 0.2],
    Array.from({ length: VOCAB }, (_, i) => [BAR_X(i), BASE_Y + 0.5, 0.2] as Vec3),
    "white",
    0.95,
  );

  let colors = tones(skin.currentPalette ?? FALLBACK_PALETTE);
  let tick = 0;
  const next = ticker(2);
  const m = new Matrix4();
  const pos = new Vector3();
  const scale = new Vector3(1, 1, 1);
  const q = new Color();
  const paint = () => {
    const raw = Array.from({ length: VOCAB }, (_, i) => Math.exp(2.8 * scatter(i, tick)));
    const top = Math.max(...raw);
    raw.forEach((r, i) => {
      const h = Math.max(0.08, (r / top) * 2.9);
      pos.set(BAR_X(i), BASE_Y + h / 2, 0.2);
      scale.set(1, h, 1);
      bars.setMatrixAt(i, m.compose(pos, IDENTITY, scale));
      bars.setColorAt(i, r === top ? colors.signal : q.copy(colors.idle).lerp(colors.hot, r / top));
    });
    bars.instanceMatrix.needsUpdate = true;
    if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
    for (let i = 0; i < nodes.length; i++) nodeMesh.setColorAt(i, scatter(i, tick + 5) < 0.45 ? colors.hot : colors.idle);
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
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
