import { makeBootstrap } from "../../terminal/fixtures";
import { readoutFor } from "../readout";
import { parseCssColor } from "./palette";
import { DPR_STEPS, lowerDpr, qualitySettings, shouldDegrade } from "./quality";
import {
  anchorsFromRects,
  catmullRom,
  fractionalStation,
  pickTiles,
  POSES,
  poseFor,
  ringCount,
  samplePath,
  stationWeights,
  tierRing,
} from "./stations";

describe("scroll → station mapping", () => {
  it("centres each section in the viewport and keeps anchors strictly increasing", () => {
    // Two 600px sections stacked, 800px viewport, scrolled to 0.
    const anchors = anchorsFromRects(
      [
        { top: 0, height: 600 },
        { top: 600, height: 600 },
      ],
      0,
      800,
    );
    expect(anchors).toEqual([-100, 500]);
    // Overlapping/duplicate positions are nudged apart so interpolation never divides by zero.
    const dup = anchorsFromRects(
      [
        { top: 0, height: 100 },
        { top: 0, height: 100 },
      ],
      0,
      100,
    );
    expect(dup[1]).toBeGreaterThan(dup[0]);
  });

  it("interpolates between anchors and clamps at both ends", () => {
    const anchors = [0, 100, 300];
    expect(fractionalStation(-50, anchors)).toBe(0);
    expect(fractionalStation(0, anchors)).toBe(0);
    expect(fractionalStation(50, anchors)).toBe(0.5);
    expect(fractionalStation(100, anchors)).toBe(1);
    expect(fractionalStation(200, anchors)).toBe(1.5);
    expect(fractionalStation(999, anchors)).toBe(2);
    expect(fractionalStation(10, [5])).toBe(0);
    expect(fractionalStation(10, [])).toBe(0);
  });

  it("weights each section's visual by how close the camera is", () => {
    const keys = ["hero", "projects", "skills"];
    expect(stationWeights(keys, 1)).toEqual({ hero: 0, projects: 1, skills: 0 });
    const half = stationWeights(keys, 1.5);
    expect(half.projects).toBeCloseTo(0.5, 5);
    expect(half.skills).toBeCloseTo(0.5, 5);
    expect(half.hero).toBe(0);
    // A repeated key keeps its strongest weight.
    expect(stationWeights(["a", "b", "a"], 2).a).toBe(1);
  });
});

describe("camera path", () => {
  it("passes exactly through each station pose", () => {
    const keys = ["hero", "experience", "projects", "contact"];
    const poses = keys.map(poseFor);
    keys.forEach((_, i) => {
      const p = samplePath(poses, i);
      p.pos.forEach((v, k) => expect(v).toBeCloseTo(poses[i].pos[k], 6));
      p.look.forEach((v, k) => expect(v).toBeCloseTo(poses[i].look[k], 6));
    });
  });

  it("moves continuously between stations (no jumps)", () => {
    const poses = ["hero", "about", "projects", "contact"].map(poseFor);
    let prev = samplePath(poses, 0).pos;
    for (let f = 0.02; f <= 3; f += 0.02) {
      const cur = samplePath(poses, f).pos;
      const step = Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
      expect(step).toBeLessThan(3);
      prev = cur;
    }
  });

  it("handles one or zero stations and out-of-range input", () => {
    expect(samplePath([], 3)).toEqual(POSES.ambient);
    expect(samplePath([POSES.hero], 5)).toEqual(POSES.hero);
    const poses = [POSES.hero, POSES.about];
    expect(samplePath(poses, -4).pos).toEqual(POSES.hero.pos);
    expect(samplePath(poses, 99).pos).toEqual(POSES.about.pos);
  });

  it("falls back to the ambient pose for unknown sections", () => {
    expect(poseFor("nope")).toBe(POSES.ambient);
  });

  it("catmullRom hits its end points", () => {
    const a: [number, number, number] = [0, 0, 0];
    const b: [number, number, number] = [1, 2, 3];
    expect(catmullRom(a, a, b, b, 0)).toEqual(a);
    expect(catmullRom(a, a, b, b, 1)).toEqual(b);
  });
});

describe("die tiles", () => {
  it("assigns distinct, in-range, deterministic tiles to projects", () => {
    const tiles = pickTiles(6, 10);
    expect(tiles).toHaveLength(6);
    expect(new Set(tiles).size).toBe(6);
    expect(tiles.every((t) => t >= 0 && t < 100)).toBe(true);
    expect(pickTiles(6, 10)).toEqual(tiles);
    // Adding a project keeps earlier projects on the same tiles.
    expect(pickTiles(7, 10).slice(0, 6)).toEqual(tiles);
  });

  it("never returns more tiles than exist", () => {
    expect(pickTiles(500, 6)).toHaveLength(36);
    expect(new Set(pickTiles(36, 6)).size).toBe(36);
    expect(pickTiles(0, 6)).toEqual([]);
    expect(pickTiles(-3, 6)).toEqual([]);
  });

  it("spreads tiles over the die rather than clustering", () => {
    const g = 10;
    const tiles = pickTiles(6, g);
    const quadrants = new Set(tiles.map((t) => Number(t % g >= g / 2) + 2 * Number(Math.floor(t / g) >= g / 2)));
    expect(quadrants.size).toBeGreaterThanOrEqual(3);
  });
});

describe("memory rings", () => {
  it("builds between 3 and 6 rings and puts the first skill group on the hottest (top) ring", () => {
    expect(ringCount(0)).toBe(3);
    expect(ringCount(4)).toBe(4);
    expect(ringCount(30)).toBe(6);
    expect(tierRing(0, 4)).toBe(3);
    expect(tierRing(3, 4)).toBe(0);
    // Extra groups share the bottom ring instead of indexing past it.
    expect(tierRing(9, 4)).toBe(0);
    expect(tierRing(-1, 4)).toBe(3);
  });
});

describe("quality tiers", () => {
  it("scales the budget down with the tier and refuses to run without WebGL", () => {
    const high = qualitySettings("high")!;
    const medium = qualitySettings("medium")!;
    const low = qualitySettings("low")!;
    expect(high.particles).toBeGreaterThan(medium.particles);
    expect(medium.particles).toBeGreaterThan(low.particles);
    expect(high.grid).toBeGreaterThan(low.grid);
    expect(low.pointerFx).toBe(false);
    expect(qualitySettings("none")).toBeNull();
  });

  it("steps pixel ratio down to a floor", () => {
    expect(lowerDpr(2)).toBe(1.5);
    expect(lowerDpr(1.5)).toBe(1.25);
    expect(lowerDpr(0.75)).toBeNull();
    expect(DPR_STEPS[0]).toBeGreaterThan(DPR_STEPS[DPR_STEPS.length - 1]);
  });

  it("only degrades after enough slow frames", () => {
    expect(shouldDegrade(Array(30).fill(60))).toBe(false); // too few samples
    expect(shouldDegrade(Array(90).fill(16))).toBe(false);
    expect(shouldDegrade(Array(90).fill(40))).toBe(true);
  });
});

describe("palette parsing", () => {
  it("reads hex and rgb() tokens from the stylesheet", () => {
    expect(parseCssColor("#ffffff")).toEqual([1, 1, 1]);
    expect(parseCssColor(" #0b1c2c ")?.map((c) => Math.round(c * 255))).toEqual([11, 28, 44]);
    expect(parseCssColor("#f80")?.map((c) => Math.round(c * 255))).toEqual([255, 136, 0]);
    expect(parseCssColor("rgb(230 236 242 / 0.12)")?.map((c) => Math.round(c * 255))).toEqual([230, 236, 242]);
    expect(parseCssColor("rgba(255, 0, 0, 0.5)")).toEqual([1, 0, 0]);
  });

  it("rejects things that aren't colours", () => {
    expect(parseCssColor("")).toBeNull();
    expect(parseCssColor("var(--bg)")).toBeNull();
    expect(parseCssColor("#12")).toBeNull();
    expect(parseCssColor("rgb(1 2)")).toBeNull();
  });
});

describe("telemetry readout", () => {
  it("reports real counts from the content", () => {
    const b = makeBootstrap();
    expect(readoutFor("projects", b)).toEqual({ label: "projects, one die tile each", value: 2 });
    expect(readoutFor("experience", b)?.value).toBe(3);
    expect(readoutFor("contact", b)?.value).toBe(2); // one social link + email
    expect(readoutFor("about", b)).toBeNull();
    expect(readoutFor("skills", { ...b, skills: [{ id: 1, skills: [{ id: 1 }, { id: 2 }] } as never] })?.value).toBe(2);
  });
});
