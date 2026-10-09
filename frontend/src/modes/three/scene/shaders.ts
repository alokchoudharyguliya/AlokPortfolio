/**
 * GLSL for the 3D scene. Everything is procedural, so there are no model or
 * texture downloads, and animation runs on the GPU (the CPU only updates a
 * few uniforms per frame).
 *
 * Colours arrive as display-space (sRGB) uniforms taken from the CSS tokens
 * and are written straight out, so the canvas matches the page exactly in
 * both themes. `uDark` selects additive "glow" looks (dark) or ink-on-paper
 * "blueprint" looks (light). `uOut` flips data flow from inbound to outbound
 * at the contact station (a result being written back).
 */

/** The die floor: fine + coarse grid, die outline, travelling rings, pointer hover and click ripples. */
export const SUBSTRATE_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const SUBSTRATE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDark;
uniform float uReveal;
uniform float uOut;
uniform vec2 uPointer;
uniform float uHover;
uniform vec2 uPulsePos;
uniform float uPulseAge;
uniform vec3 uInk;
uniform vec3 uSignal;
uniform vec3 uF1;
uniform vec3 uF3;
uniform vec3 uF4;
varying vec3 vWorld;

float gridLine(vec2 p, float size, float width) {
  vec2 q = p / size;
  vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
  return 1.0 - clamp(min(g.x, g.y) / width, 0.0, 1.0);
}

void main() {
  vec2 p = vWorld.xz;
  float r = length(p);

  float fine = gridLine(p, 1.0, 1.0) * 0.28;
  float coarse = gridLine(p, 6.0, 1.4) * 0.62;

  // Rings travel outward (result) or inward (input) from the die centre.
  float dir = 1.0 - 2.0 * uOut;
  float wave = fract(r * 0.045 - uTime * 0.1 * dir);
  float ring = (1.0 - smoothstep(0.0, 0.025, abs(wave - 0.5))) * (1.0 - smoothstep(10.0, 52.0, r));

  // Die outline (a 27-unit square) with a bright inner glow.
  float box = max(abs(p.x), abs(p.y));
  float outline = 1.0 - smoothstep(0.0, 0.16, abs(box - 13.5));
  float inside = 1.0 - smoothstep(13.0, 13.6, box);

  // Pointer: soft hover glow + an expanding ring after each click.
  float hover = exp(-dot(p - uPointer, p - uPointer) / 14.0) * uHover;
  float clickR = uPulseAge * 16.0;
  float click = (1.0 - smoothstep(0.0, 1.4, abs(length(p - uPulsePos) - clickR))) * exp(-uPulseAge * 1.7);

  // Power-on: the grid draws outward from the centre as uReveal goes 0 → 1.
  float reveal = 1.0 - smoothstep(uReveal * 70.0 - 14.0, uReveal * 70.0, r);
  float fade = (1.0 - smoothstep(26.0, 64.0, r)) * reveal;

  float lines = coarse + fine + outline * 1.2 + ring * 0.9;
  vec3 lineCol = uDark > 0.5 ? mix(uInk, uF3, 0.62) : mix(uInk, uF4, 0.25);
  vec3 glow = mix(uF1, uSignal, 0.5);

  float wLine = lines;
  float wGlow = hover * 0.7 + click * 1.4 + ring * 0.4 + outline * 0.3;
  vec3 col = (lineCol * wLine + glow * wGlow) / max(wLine + wGlow, 0.001);
  float a = (lines * (uDark > 0.5 ? 0.42 : 0.5) + inside * 0.08 + hover * 0.22 + click * 0.8) * fade;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;

/** Instanced tiles: streaming-multiprocessor blocks (and memory stacks) with travelling activity waves. */
export const TILE_VERT = /* glsl */ `
attribute float aSeed;
attribute float aProject;
attribute float aIndex;
uniform float uHi;
uniform float uHiAmt;
uniform float uReveal;
varying vec3 vN;
varying vec2 vUv;
varying float vSeed;
varying float vProject;
varying float vHi;
varying float vDist;
varying vec3 vWorld;

void main() {
  vec4 p = instanceMatrix * vec4(position, 1.0);
  float hi = (1.0 - step(0.5, abs(aIndex - uHi))) * uHiAmt;
  // Tiles rise from the substrate during power-on, staggered by distance from the centre.
  float rise = smoothstep(0.0, 0.4, uReveal * 1.5 - length(p.xz) / 30.0);
  p.y *= mix(0.02, 1.0, rise);
  p.y += hi * 1.3;
  vec4 w = modelMatrix * p;
  vec4 mv = viewMatrix * w;
  vWorld = w.xyz;
  vN = normal;
  vUv = uv;
  vSeed = aSeed;
  vProject = aProject;
  vHi = hi;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const TILE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDark;
uniform float uOut;
uniform float uStageProjects;
uniform vec3 uBg;
uniform vec3 uSurface;
uniform vec3 uSurface2;
uniform vec3 uF1;
uniform vec3 uF2;
uniform vec3 uF4;
varying vec3 vN;
varying vec2 vUv;
varying float vSeed;
varying float vProject;
varying float vHi;
varying float vDist;
varying vec3 vWorld;

void main() {
  vec3 n = normalize(vN);
  float top = step(0.5, n.y);
  vec3 L = normalize(vec3(-0.4, 0.9, 0.5));
  float lambert = max(dot(n, L), 0.0) * 0.55 + 0.45;

  // A wave of activity sweeps across the die; each tile has its own phase.
  float d = length(vWorld.xz);
  float wave = 0.5 + 0.5 * sin(d * 0.55 - uTime * 1.6 * (1.0 - 2.0 * uOut) + vSeed * 6.2831);
  float act = smoothstep(0.8, 1.0, wave);

  vec2 e = min(vUv, 1.0 - vUv);
  float edge = 1.0 - smoothstep(0.0, 0.08, min(e.x, e.y));

  float emphasis = vProject * uStageProjects * (0.65 + 0.35 * sin(uTime * 3.0 + vSeed * 6.0));
  float glow = top * (act * 0.7 + edge * 0.38) + emphasis * (0.55 + top * 0.6) + vHi * 1.5;

  vec3 base = mix(uSurface, uSurface2, vSeed) * lambert;
  vec3 hot = mix(uF2, uF1, clamp(vProject + vHi, 0.0, 1.0));
  vec3 col = base + hot * glow * (uDark > 0.5 ? 1.0 : 0.85);
  // Side faces get a faint warm rim so the blocks read against the floor.
  col += uF4 * (1.0 - top) * edge * 0.25;

  col = mix(col, uBg, smoothstep(70.0, 150.0, vDist));
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Data-flow particles: each follows a lane from a far source to a tile; positions are computed on the GPU. */
export const PARTICLE_VERT = /* glsl */ `
attribute vec3 aStart;
attribute float aPhase;
attribute float aSpeed;
attribute float aSize;
uniform float uTime;
uniform float uOut;
uniform float uPixel;
uniform float uReveal;
varying float vAlpha;
varying float vT;

void main() {
  float t = fract(uTime * aSpeed * 0.06 + aPhase);
  float tt = mix(t, 1.0 - t, uOut);
  float e = pow(tt, 1.7);
  // position is the lane's end point (a tile top); aStart is far out in the data cloud.
  vec3 p = mix(aStart, position, e);

  // Gentle spiral around the lane, tightening as the particle converges.
  vec3 dir = normalize(position - aStart);
  vec3 side = normalize(cross(dir, vec3(0.0, 1.0, 0.0)) + vec3(0.0001));
  vec3 up = cross(side, dir);
  float ang = uTime * 0.8 + aPhase * 40.0;
  p += (side * sin(ang) + up * cos(ang)) * (1.0 - e) * 1.6;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPixel / max(-mv.z, 0.1) * (0.45 + e * 0.95), 1.0, 11.0);
  // Fade in with distance so particles drifting past the lens never become big blobs over the text.
  float near = smoothstep(6.0, 26.0, -mv.z);
  vAlpha = smoothstep(0.0, 0.1, tt) * (1.0 - smoothstep(0.94, 1.0, tt)) * smoothstep(0.0, 0.35, uReveal) * near;
  vT = e;
}
`;

export const PARTICLE_FRAG = /* glsl */ `
uniform float uDark;
uniform vec3 uF1;
uniform vec3 uF3;
uniform vec3 uInk;
varying float vAlpha;
varying float vT;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float disc = 1.0 - smoothstep(0.55, 1.0, d);
  vec3 col = mix(uF1, uF3, vT);
  col = uDark > 0.5 ? col : mix(col, uInk, 0.35);
  gl_FragColor = vec4(col, disc * vAlpha * (uDark > 0.5 ? 0.75 : 0.7));
}
`;

/** Memory-hierarchy rings (skills): dashed arcs rotating at a speed per tier, hotter rings nearer the top. */
export const RING_VERT = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const RING_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDark;
uniform float uWeight;
uniform float uTier;
uniform float uHot;
uniform float uSpeed;
uniform float uBoost;
uniform vec3 uF1;
uniform vec3 uF3;
uniform vec3 uInk;
varying vec2 vPos;

void main() {
  float ang = atan(vPos.y, vPos.x) + uTime * uSpeed;
  float dash = smoothstep(0.35, 0.5, abs(sin(ang * (6.0 + uTier * 3.0))));
  float lit = clamp(mix(0.1, 1.0, uWeight) + uBoost, 0.0, 1.4);
  vec3 col = mix(uF3, uF1, uHot);
  col = uDark > 0.5 ? col : mix(col, uInk, 0.4);
  gl_FragColor = vec4(col, (0.18 + dash * 0.62) * lit * (0.45 + uHot * 0.55));
}
`;

/** Pipeline tube (experience): bright pulses flowing along the path. */
export const PIPE_VERT = /* glsl */ `
varying float vU;
void main() {
  vU = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const PIPE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDark;
uniform float uWeight;
uniform vec3 uF1;
uniform vec3 uF3;
uniform vec3 uInk;
varying float vU;

void main() {
  float pulse = smoothstep(0.55, 1.0, sin(vU * 60.0 - uTime * 2.4) * 0.5 + 0.5);
  vec3 col = mix(uF3, uF1, pulse);
  col = uDark > 0.5 ? col : mix(col, uInk, 0.3);
  float a = (0.22 + pulse * 0.7) * mix(0.14, 1.0, uWeight);
  gl_FragColor = vec4(col, a);
}
`;
