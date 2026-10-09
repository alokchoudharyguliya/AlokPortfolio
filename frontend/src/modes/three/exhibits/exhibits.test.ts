import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { EXHIBIT_OPTIONS } from "@/domain/resources";

import { FALLBACK_PALETTE } from "../scene/palette";
import { poseFor } from "../scene/stations";
import type { Pose } from "../scene/stations";
import { EXHIBITS, EXHIBIT_IDS, EXHIBIT_ORIGINS, exhibitForKey, exhibitKey, isExhibitId, isExhibitKey, linkedExhibits } from "./catalog";
import {
  diveDepth,
  fractionalStationHeld,
  interpolatePose,
  lerpPose,
  levelAt,
  levelWindow,
  poseAtDepth,
  stationLayout,
  trapezoid,
} from "./dive";
import { EXHIBIT_FACTORIES } from "./index";

const dist = (p: Pose) => Math.hypot(p.pos[0] - p.look[0], p.pos[1] - p.look[1], p.pos[2] - p.look[2]);

describe("catalogue", () => {
  it("describes every exhibit with at least two levels and unique level ids", () => {
    for (const id of EXHIBIT_IDS) {
      const def = EXHIBITS[id];
      expect(def.id).toBe(id);
      expect(def.levels.length).toBeGreaterThanOrEqual(2);
      expect(new Set(def.levels.map((l) => l.id)).size).toBe(def.levels.length);
      for (const l of def.levels) expect(l.caption.length).toBeGreaterThan(20);
    }
  });

  it("has a three.js builder for every catalogued exhibit", () => {
    expect(Object.keys(EXHIBIT_FACTORIES).sort()).toEqual([...EXHIBIT_IDS].sort());
  });

  it("matches the options offered in the owner's editor and the backend choices", () => {
    expect(EXHIBIT_OPTIONS.map((o) => o.value).sort()).toEqual([...EXHIBIT_IDS].sort());
  });

  it("recognises station keys", () => {
    expect(exhibitKey("hardware")).toBe("exhibit:hardware");
    expect(isExhibitKey("exhibit:hardware")).toBe(true);
    expect(isExhibitKey("skills")).toBe(false);
    expect(exhibitForKey("exhibit:hardware")?.id).toBe("hardware");
    expect(exhibitForKey("exhibit:nope")).toBeNull();
    expect(exhibitForKey("skills")).toBeNull();
    expect(isExhibitId("hardware")).toBe(true);
    expect(isExhibitId("")).toBe(false);
    expect(isExhibitId(undefined)).toBe(false);
  });

  it("lists linked exhibits once each, in group order, ignoring unknown or empty ids", () => {
    const list = linkedExhibits([{ exhibit: "" }, { exhibit: "hardware" }, {}, { exhibit: "bogus" }, { exhibit: "hardware" }]);
    expect(list.map((e) => e.id)).toEqual(["hardware"]);
    expect(linkedExhibits([])).toEqual([]);
  });

  it("gives exhibit stations their wide shot from the catalogue", () => {
    expect(poseFor("exhibit:hardware")).toBe(EXHIBITS.hardware.wide);
    expect(poseFor("exhibit:unknown")).toBe(poseFor("ambient"));
  });
});

describe("dive maths", () => {
  it("lays out ordinary stations by centre and pinned ones by their top, with a hold", () => {
    // viewport 800: a normal panel 400 tall at y=1000 centres at scroll 1000+200-400 = 800.
    const rects = [
      { top: 1000, height: 400 }, // normal
      { top: 2000, height: 2400 }, // pinned, 3 viewports tall (2 of travel)
      { top: 4400, height: 400 }, // normal, right after
    ];
    const { anchors, holds } = stationLayout(rects, [0, 3, 0], 0, 800);
    expect(anchors[0]).toBe(800);
    expect(holds[0]).toBe(0);
    expect(anchors[1]).toBe(2000);
    expect(holds[1]).toBe(1600);
    expect(anchors[2]).toBe(4400 + 200 - 400);
    expect(anchors[2]).toBeGreaterThan(anchors[1] + holds[1]);
  });

  it("forces anchors to start after the previous hold, never overlapping", () => {
    const { anchors, holds } = stationLayout(
      [
        { top: 0, height: 2000 },
        { top: 100, height: 400 },
      ],
      [3, 0],
      0,
      800,
    );
    expect(anchors[1]).toBeGreaterThanOrEqual(anchors[0] + holds[0] + 1);
  });

  it("holds the camera on a pinned station, then flies on", () => {
    const anchors = [0, 1000, 3000];
    const holds = [0, 1600, 0];
    expect(fractionalStationHeld(-50, anchors, holds)).toBe(0);
    expect(fractionalStationHeld(500, anchors, holds)).toBeCloseTo(0.5);
    expect(fractionalStationHeld(1000, anchors, holds)).toBe(1);
    expect(fractionalStationHeld(1800, anchors, holds)).toBe(1); // held mid-dive
    expect(fractionalStationHeld(2600, anchors, holds)).toBe(1); // hold ends here
    expect(fractionalStationHeld(2800, anchors, holds)).toBeCloseTo(1 + 200 / 400);
    expect(fractionalStationHeld(9999, anchors, holds)).toBe(2);
  });

  it("never runs backwards as scroll increases", () => {
    const anchors = [0, 700, 2500, 3300];
    const holds = [0, 1200, 0, 0];
    let prev = -1;
    for (let y = -100; y < 4000; y += 7) {
      const f = fractionalStationHeld(y, anchors, holds);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });

  it("maps scroll to depth, clamped to the exhibit's levels", () => {
    expect(diveDepth(0, 1000, 1600, 5)).toBe(0);
    expect(diveDepth(1000, 1000, 1600, 5)).toBe(0);
    expect(diveDepth(1800, 1000, 1600, 5)).toBeCloseTo(2);
    expect(diveDepth(2600, 1000, 1600, 5)).toBe(4);
    expect(diveDepth(9000, 1000, 1600, 5)).toBe(4);
    expect(diveDepth(1500, 1000, 0, 5)).toBe(0);
    expect(diveDepth(1500, 1000, 1600, 1)).toBe(0);
  });

  it("picks the nearest level for captions", () => {
    expect(levelAt(0, 5)).toBe(0);
    expect(levelAt(1.4, 5)).toBe(1);
    expect(levelAt(1.6, 5)).toBe(2);
    expect(levelAt(99, 5)).toBe(4);
    expect(levelAt(-3, 5)).toBe(0);
  });

  it("builds a trapezoid that is 0 outside, 1 inside, and smooth on the edges", () => {
    expect(trapezoid(0, 1, 2, 3, 4)).toBe(0);
    expect(trapezoid(5, 1, 2, 3, 4)).toBe(0);
    expect(trapezoid(2.5, 1, 2, 3, 4)).toBe(1);
    expect(trapezoid(1.5, 1, 2, 3, 4)).toBeCloseTo(0.5);
    expect(trapezoid(3.5, 1, 2, 3, 4)).toBeCloseTo(0.5);
    expect(trapezoid(1.25, 1, 2, 3, 4)).toBeLessThan(trapezoid(1.75, 1, 2, 3, 4));
  });

  it("windows levels so that the first is solid before the dive and the last stays to the end", () => {
    const [first, last] = [levelWindow(0, 5), levelWindow(4, 5)];
    expect(trapezoid(0, ...first)).toBe(1);
    expect(trapezoid(-5, ...first)).toBe(1);
    expect(trapezoid(1.5, ...first)).toBe(0);
    expect(trapezoid(4, ...last)).toBe(1);
    expect(trapezoid(50, ...last)).toBe(1);
    expect(trapezoid(2, ...last)).toBe(0);
    // Middle levels cross-fade: at the halfway point two neighbours are each partly visible.
    const mid = trapezoid(1.5, ...levelWindow(1, 5)) + trapezoid(1.5, ...levelWindow(2, 5));
    expect(mid).toBeGreaterThan(0.9);
  });

  it("interpolates camera distance geometrically", () => {
    const a: Pose = { pos: [0, 0, 100], look: [0, 0, 0] };
    const b: Pose = { pos: [0, 0, 1], look: [0, 0, 0] };
    const mid = interpolatePose(a, b, 0.5);
    expect(dist(mid)).toBeCloseTo(10, 5); // √(100·1), not the arithmetic 50.5
    expect(dist(interpolatePose(a, b, 0))).toBeCloseTo(100);
    expect(dist(interpolatePose(a, b, 1))).toBeCloseTo(1);
  });

  it("blends poses linearly and samples depth poses with ease", () => {
    const a: Pose = { pos: [0, 0, 10], look: [0, 0, 0] };
    const b: Pose = { pos: [10, 0, 10], look: [0, 0, 0] };
    expect(lerpPose(a, b, 0.5).pos).toEqual([5, 0, 10]);
    expect(poseAtDepth([a, b], 0).pos[0]).toBeCloseTo(0);
    expect(poseAtDepth([a, b], 1).pos[0]).toBeCloseTo(10);
    expect(poseAtDepth([a, b], 9).pos[0]).toBeCloseTo(10);
    expect(() => poseAtDepth([], 0)).toThrow();
  });
});

describe.each(EXHIBIT_IDS)("%s exhibit (no WebGL needed to build it)", (id) => {
  const create = EXHIBIT_FACTORIES[id];
  const frame = (depth: number, weight = 1) => ({ time: 3, depth, weight, reduced: false, aspect: 1.6 });

  it("flies in from a wide overview to a close view of every level", () => {
    const ex = create();
    ex.setPalette(FALLBACK_PALETTE);
    ex.update(frame(0));
    const n = EXHIBITS[id].levels.length;
    const distances = Array.from({ length: n }, (_, k) => dist(ex.poseAt(k)));
    for (const d of distances) expect(Number.isFinite(d)).toBe(true);
    // The overview is the farthest shot, and every deeper level is clearly closer.
    for (let k = 1; k < n; k++) expect(distances[k]).toBeLessThan(distances[0] * 0.6);
    // Hardware and CUDA nest each level inside the last, so they get steadily closer, by at least 50× overall.
    if (id !== "transformer") {
      for (let k = 1; k < n; k++) expect(distances[k]).toBeLessThan(distances[k - 1]);
      expect(distances[0] / distances[n - 1]).toBeGreaterThan(50);
    }
  });

  it("starts the dive from the catalogue's wide shot area, far from the die world", () => {
    const ex = create();
    ex.update(frame(0));
    const start = ex.poseAt(0);
    expect(Math.abs(start.pos[1])).toBeGreaterThan(100);
    expect(Math.abs(start.look[1] - EXHIBITS[id].wide.look[1])).toBeLessThan(4);
  });

  it("fades the board out and the registers in as depth grows", () => {
    const ex = create();
    ex.setPalette(FALLBACK_PALETTE);
    const opacities = (depth: number) => {
      ex.update(frame(depth));
      const out: number[] = [];
      ex.root.traverse((o) => {
        if (!o.visible) return;
        const m = (o as { material?: { opacity?: number } }).material;
        if (m && typeof m.opacity === "number" && m.opacity > 0) out.push(m.opacity);
      });
      return out;
    };
    const top = opacities(0);
    const deep = opacities(4);
    expect(top.length).toBeGreaterThan(5);
    expect(deep.length).toBeGreaterThan(5);
    // Different geometry is on screen at the two ends.
    expect(top.length).not.toBe(deep.length);
  });

  it("is invisible when its station is not in view", () => {
    const ex = create();
    ex.update(frame(0, 0));
    const shown: boolean[] = [];
    ex.root.traverse((o) => {
      const m = (o as { material?: { opacity?: number } }).material;
      if (m && o.visible && (m.opacity ?? 0) > 0.001) shown.push(true);
    });
    expect(shown).toEqual([]);
  });

  it("animates without throwing, and holds still under reduced motion", () => {
    const ex = create();
    ex.setPalette(FALLBACK_PALETTE);
    for (const depth of [0, 2.5, 3.5, 4]) {
      for (let t = 0; t < 5; t += 0.7) ex.update({ time: t, depth, weight: 1, reduced: false, aspect: 1.6 });
    }
    ex.update({ time: 0, depth: 0, weight: 1, reduced: true, aspect: 1.6 });
    const a = ex.poseAt(0);
    ex.update({ time: 99, depth: 0, weight: 1, reduced: true, aspect: 1.6 });
    const b = ex.poseAt(0);
    expect(b.pos).toEqual(a.pos);
  });

  it("frames the subject away from the caption: right on wide screens, higher on tall ones", () => {
    const ex = create();
    const local = (aspect: number) => {
      ex.update({ time: 0, depth: 4, weight: 1, reduced: true, aspect });
      return ex.poseAt(4).look;
    };
    ex.update({ time: 0, depth: 4, weight: 1, reduced: true, aspect: 1.6 });
    const wide = ex.poseAt(4).look;
    ex.update({ time: 0, depth: 4, weight: 1, reduced: true, aspect: 0.5 });
    const tall = ex.poseAt(4).look;
    expect(wide).not.toEqual(tall);
    expect(local(1.6)).toEqual(wide);
  });

  it("stops swaying once the camera has committed to the dive", () => {
    const ex = create();
    ex.update({ time: 1, depth: 3, weight: 1, reduced: false, aspect: 1.6 });
    const a = ex.poseAt(3);
    ex.update({ time: 5, depth: 3, weight: 1, reduced: false, aspect: 1.6 });
    const b = ex.poseAt(3);
    expect(b.pos[0]).toBeCloseTo(a.pos[0], 6);
    expect(b.pos[2]).toBeCloseTo(a.pos[2], 6);
  });

  it("stays inside its own region of space, away from every other exhibit", () => {
    const ex = create();
    ex.update(frame(0));
    const box = new Box3().setFromObject(ex.root);
    const origin = EXHIBIT_ORIGINS[id];
    for (const other of EXHIBIT_IDS) {
      if (other === id) continue;
      const o = EXHIBIT_ORIGINS[other];
      expect(Math.hypot(origin[0] - o[0], origin[1] - o[1], origin[2] - o[2])).toBeGreaterThan(100);
    }
    expect(box.containsPoint(new Vector3(...origin))).toBe(true);
    // Far from the die world (y 0…35, |x|,|z| < 90).
    expect(box.max.y < -20 || box.min.y > 60).toBe(true);
  });
});
