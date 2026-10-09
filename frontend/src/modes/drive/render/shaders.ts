/**
 * GLSL for the three things that need custom shading: the road surface (lane
 * markings, grain, night headlight glow), the sky (gradient, sun / moon, stars)
 * and the boost pads. Everything else uses stock Lambert materials.
 *
 * Colour handling: uniforms are passed in the working (linear) colour space and
 * `colorspace_fragment` converts to display, then `fog_fragment` runs — the same
 * order three.js uses for its built-in unlit materials.
 */
import { ROAD_HALF } from "../engine/route";

const HASH = /* glsl */ `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`;

export const ROAD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export const ROAD_FRAG = /* glsl */ `
uniform vec3 uAsphalt;
uniform vec3 uMarking;
uniform float uNight;
uniform vec3 uHeadPos;
uniform vec3 uHeadDir;
varying vec2 vUv;
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>
${HASH}
void main() {
  float lat = (vUv.x - 0.5) * ${(ROAD_HALF * 2).toFixed(1)};   // metres from the centre line, + right
  float s = vUv.y;                                              // metres along the road
  vec3 col = uAsphalt;

  // Asphalt grain and two faint tyre tracks per lane.
  float grain = hash(floor(vec2(lat * 2.5, s * 2.5)));
  col *= 0.9 + 0.2 * grain;
  float lane = abs(fract((lat + 6.0) / 4.0) - 0.5);
  col *= 1.0 - 0.06 * smoothstep(0.32, 0.18, abs(lane - 0.3));

  // Solid edge lines and dashed lane dividers.
  float edge = smoothstep(0.2, 0.12, abs(abs(lat) - ${(ROAD_HALF - 0.45).toFixed(2)}));
  float dash = step(mod(s, 9.0), 4.5);
  float div = smoothstep(0.11, 0.07, abs(abs(lat) - 2.0)) * dash;
  col = mix(col, uMarking, max(edge, div) * 0.92);

  // Headlight pool in front of the car at night.
  vec3 toFrag = vWorld - uHeadPos;
  float d = length(toFrag);
  float cone = smoothstep(0.55, 0.97, dot(normalize(toFrag), uHeadDir));
  col += uNight * cone * exp(-d * 0.06) * vec3(0.95, 0.96, 1.0) * 0.16;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // always at the far plane
}
`;

export const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNight;
uniform float uTime;
varying vec3 vDir;
#include <common>
${HASH}
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.5));

  // Sun by day, moon at night: a disc and a soft glow.
  float sd = max(dot(d, uSunDir), 0.0);
  float disc = smoothstep(0.9986, 0.9991, sd);
  float glow = pow(sd, 60.0) * 0.28 + pow(sd, 6.0) * 0.06;
  col += uSunColor * (disc + glow);

  // Stars: sparse hashed cells that twinkle, only above the horizon at night.
  vec2 g = vec2(atan(d.z, d.x) * 210.0, d.y * 210.0);
  vec2 id = floor(g);
  float r = hash(id);
  vec2 jitter = vec2(hash(id + 7.3), hash(id + 19.1)) - 0.5;
  float dist = length(fract(g) - 0.5 - jitter * 0.5);
  float star = step(0.975, r) * smoothstep(0.16, 0.0, dist) * smoothstep(0.05, 0.35, d.y) * uNight;
  col += star * (0.55 + 0.45 * sin(uTime * 2.0 + r * 60.0));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export const PAD_VERT = /* glsl */ `
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export const PAD_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uNight;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  vec2 p = vUv * 2.0 - 1.0;                       // −1…1, +y = direction of travel
  float v = fract((p.y + abs(p.x) * 0.8) * 1.5 - uTime * 1.3);
  float chevron = smoothstep(0.0, 0.1, v) * smoothstep(0.42, 0.3, v);
  float fade = smoothstep(1.0, 0.8, abs(p.x)) * smoothstep(1.0, 0.85, abs(p.y));
  float a = chevron * fade * (0.75 + 0.25 * uNight);
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
