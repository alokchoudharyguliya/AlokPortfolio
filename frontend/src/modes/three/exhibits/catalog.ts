/**
 * Exhibit catalogue — the data side of the "dive" feature. No three.js and no
 * DOM, so the page (captions, breadcrumb, static fallback), the scroll maths
 * and the tests can all import it cheaply.
 *
 * An exhibit is a self-contained 3D object the camera descends into, one
 * `level` per stop (motherboard → package → cache → core → registers). The
 * owner links a skill group to one through `SkillCategory.exhibit` (backend
 * `SkillCategory.EXHIBIT_CHOICES` mirrors the ids below — keep them in sync);
 * the exhibit then appears as a pinned interlude after the Skills section.
 *
 * The three.js construction of each exhibit lives beside this file
 * (`hardware.ts`, …) and is registered in `index.ts`.
 */
import type { Pose } from "../scene/stations";

export interface ExhibitLevel {
  id: string;
  /** Short name used in the breadcrumb: `Motherboard › Package › …` */
  label: string;
  /** One or two sentences shown while this level is in view. */
  caption: string;
}

export interface ExhibitDef {
  id: ExhibitId;
  title: string;
  /** Small label above the title. */
  kicker: string;
  /** What the viewer is about to do. */
  blurb: string;
  levels: ExhibitLevel[];
  /**
   * Where the camera rests before the dive starts (world space). The exhibit
   * itself is built far above the GPU-die world so nothing else is in shot.
   */
  wide: Pose;
}

export const EXHIBIT_IDS = ["hardware", "cuda", "transformer"] as const;
export type ExhibitId = (typeof EXHIBIT_IDS)[number];

/**
 * Where each exhibit lives in world space. The die world is within ~90 units of the origin and
 * below y = 35, so exhibits sit far above or below it, and on opposite sides of each other, so two
 * worlds are never in shot together. Coordinates stay near 120 so float32 keeps the tiny deep levels steady.
 */
export const EXHIBIT_ORIGINS: Record<ExhibitId, [number, number, number]> = {
  hardware: [0, 120, 0],
  cuda: [0, -120, 0],
  transformer: [0, 240, 0],
};

export const EXHIBITS: Record<ExhibitId, ExhibitDef> = {
  hardware: {
    id: "hardware",
    title: "From the board to the register",
    kicker: "Hardware exhibit",
    blurb: "Scroll to fall through a computer: board, package, cache, core, and finally the registers where the arithmetic happens.",
    wide: { pos: [-5, 128, 41], look: [-3, 124, 1] },
    levels: [
      {
        id: "board",
        label: "Motherboard",
        caption:
          "Everything starts on the board: the CPU socket, memory slots, PCIe lanes and chipset that wire a processor to the rest of the machine.",
      },
      {
        id: "package",
        label: "CPU package",
        caption:
          "Under the heat spreader sits a die flip-chipped onto a substrate, ringed by decoupling capacitors and fed through hundreds of contacts.",
      },
      {
        id: "cache",
        label: "Cache hierarchy",
        caption:
          "A big shared L3 sits between the cores and each core owns a private L2. Every level trades capacity for latency.",
      },
      {
        id: "core",
        label: "Core",
        caption:
          "One core: a front end that fetches and decodes, an out-of-order engine, execution units, and its own L1 caches for instructions and data.",
      },
      {
        id: "registers",
        label: "Registers",
        caption:
          "The fastest storage there is: sixteen 64-bit general-purpose registers, read and written inside a single clock cycle.",
      },
    ],
  },
  cuda: {
    id: "cuda",
    title: "From the GPU to a single thread",
    kicker: "CUDA exhibit",
    blurb: "Scroll to fly into a GPU: the card, the grid of SMs, one SM, a warp, and finally a single thread.",
    wide: { pos: [-3.4, -114, 34.5], look: [-2.4, -117, 0.7] },
    levels: [
      {
        id: "gpu",
        label: "GPU",
        caption:
          "A GPU is one huge die wrapped in memory chips, power delivery and a cooler. Under the fans, thousands of arithmetic units wait for work.",
      },
      {
        id: "grid",
        label: "Grid of SMs",
        caption:
          "A kernel launch becomes a grid of thread blocks. The scheduler deals blocks out to the streaming multiprocessors (SMs) as they free up, with a shared L2 cache between them.",
      },
      {
        id: "sm",
        label: "SM",
        caption:
          "Inside one SM: four partitions, each with a warp scheduler, a register file and rows of CUDA cores, above the L1 cache and shared memory that its blocks share.",
      },
      {
        id: "warp",
        label: "Warp",
        caption:
          "Threads run in groups of 32 called warps. All 32 lanes execute the same instruction in lockstep; when a branch splits them, the lanes take turns, so divergence costs time.",
      },
      {
        id: "thread",
        label: "Thread",
        caption:
          "One thread: its own slice of the register file, an FP32 and an INT32 ALU, and a path to shared memory. Thousands of these hide each other's memory latency.",
      },
    ],
  },
  transformer: {
    id: "transformer",
    title: "Inside a transformer",
    kicker: "Deep-learning exhibit",
    blurb: "Scroll to enter a transformer: the full stack, the embeddings, multi-head attention, masked attention in the decoder, and the output distribution.",
    wide: { pos: [-2, 246, 40.7], look: [-2.9, 240, -0.7] },
    levels: [
      {
        id: "stack",
        label: "Transformer",
        caption:
          "Six encoder layers read the whole input; six decoder layers write the output one token at a time, each looking back at what the encoder produced.",
      },
      {
        id: "embedding",
        label: "Embeddings",
        caption:
          "Tokens become vectors, and a sinusoidal positional encoding is added so the model knows word order. Attention on its own has no sense of position.",
      },
      {
        id: "attention",
        label: "Multi-head attention",
        caption:
          "Every token is projected to a query, a key and a value. Eight heads compare queries with keys in parallel, softmax the scores into weights, and mix the values.",
      },
      {
        id: "masked",
        label: "Masked attention",
        caption:
          "In the decoder a causal mask hides future positions, so each token only attends to earlier ones. A cross-attention step then reads the encoder's output.",
      },
      {
        id: "output",
        label: "Output",
        caption:
          "A feed-forward network refines each position; a final linear layer and softmax turn it into a probability over the vocabulary, and the best token is the next word.",
      },
    ],
  },
};

export const exhibitKey = (id: ExhibitId) => `exhibit:${id}`;

export const isExhibitKey = (key: string) => key.startsWith("exhibit:");

export function isExhibitId(value: unknown): value is ExhibitId {
  return typeof value === "string" && (EXHIBIT_IDS as readonly string[]).includes(value);
}

/** The exhibit behind a station key (`exhibit:hardware`), or null for ordinary sections. */
export function exhibitForKey(key: string): ExhibitDef | null {
  if (!isExhibitKey(key)) return null;
  const id = key.slice("exhibit:".length);
  return isExhibitId(id) ? EXHIBITS[id] : null;
}

/** Distinct exhibits linked from skill groups, in the owner's group order. Unknown ids are ignored. */
export function linkedExhibits(categories: { exhibit?: string }[]): ExhibitDef[] {
  const seen = new Set<ExhibitId>();
  const out: ExhibitDef[] = [];
  for (const c of categories) {
    if (isExhibitId(c.exhibit) && !seen.has(c.exhibit)) {
      seen.add(c.exhibit);
      out.push(EXHIBITS[c.exhibit]);
    }
  }
  return out;
}
