/**
 * Loads the CC0 low-poly models (see docs/CREDITS.md) and prepares them for the scene:
 *   - every model is scaled to a real-world size and stood on y = 0, centred on x / z,
 *   - materials become cheap Lambert materials (flat-shaded look suits low-poly),
 *   - `instancedFrom` turns a model plus a list of transforms into InstancedMeshes,
 *     so thousands of trees and rails cost a handful of draw calls.
 *
 * Loading is lazy (this module is only imported when Drive mode opens) and
 * failure-tolerant: a missing file leaves that slot empty and the scene falls
 * back to simple procedural stand-ins rather than failing to start.
 */
import { Box3, Group, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, Vector3 } from "three";
import type { Material, Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const MODEL_BASE = "/drive/models/";

export interface DriveAssets {
  /** Traffic cars, each ~4.4 m long, facing −z (the direction of travel). */
  cars: Object3D[];
  /** Large and small tree. */
  trees: Object3D[];
  lamp: Object3D | null;
  rail: Object3D | null;
  cone: Object3D | null;
  flag: Object3D | null;
}

const CAR_FILES = ["sedan", "sedan-sports", "hatchback-sports", "suv", "taxi", "van", "truck"];

/** Kenney's car models face +z; the scene drives toward −z. */
const CAR_YAW = Math.PI;

export function toLambert(root: Object3D): Object3D {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const old = mesh.material as Material & { color?: { clone(): unknown }; map?: unknown; emissive?: unknown };
    const next = new MeshLambertMaterial();
    if (old.color) next.color.copy(old.color as never);
    if (old.map) next.map = old.map as never;
    if (old.emissive) next.emissive.copy(old.emissive as never);
    mesh.material = next;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
  return root;
}

/**
 * Wrap a model so its footprint is centred on the origin, its base sits on y = 0 and it measures
 * `size` along `axis`:
 *   "x" | "y" | "z"  that axis exactly as authored
 *   "long"           the longer of x / z, turned (if needed) so it runs along z, the direction of travel
 * `yaw` is applied first (e.g. to turn a car that faces +z around to face −z).
 */
export function normalise(model: Object3D, size: number, axis: "x" | "y" | "z" | "long", yaw = 0): Group {
  const inner = new Group();
  inner.add(model);
  inner.rotation.y = yaw;
  inner.updateMatrixWorld(true);
  let box = new Box3().setFromObject(inner);
  let dims = box.getSize(new Vector3());
  if (axis === "long" && dims.x > dims.z) {
    inner.rotation.y = yaw + Math.PI / 2;
    inner.updateMatrixWorld(true);
    box = new Box3().setFromObject(inner);
    dims = box.getSize(new Vector3());
  }
  const measured = axis === "long" ? dims.z : dims[axis];
  const scale = measured > 0 ? size / measured : 1;
  const centre = box.getCenter(new Vector3());
  inner.position.set(-centre.x, -box.min.y, -centre.z);
  const pivot = new Group();
  pivot.add(inner);
  pivot.scale.setScalar(scale);
  const wrapper = new Group();
  wrapper.add(pivot);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}

async function loadOne(loader: GLTFLoader, name: string): Promise<Object3D | null> {
  try {
    const gltf = await loader.loadAsync(`${MODEL_BASE}${name}.glb`);
    return toLambert(gltf.scene);
  } catch {
    return null;
  }
}

export async function loadAssets(): Promise<DriveAssets> {
  const loader = new GLTFLoader();
  const [cars, treeL, treeS, lamp, rail, cone, flag] = await Promise.all([
    Promise.all(CAR_FILES.map((n) => loadOne(loader, n))),
    loadOne(loader, "treeLarge"),
    loadOne(loader, "treeSmall"),
    loadOne(loader, "lightPostModern"),
    loadOne(loader, "rail"),
    loadOne(loader, "cone"),
    loadOne(loader, "flagCheckers"),
  ]);
  return {
    cars: cars.filter((m): m is Object3D => m !== null).map((m) => normalise(m, 4.4, "long", CAR_YAW)),
    trees: [treeL && normalise(treeL, 9, "y"), treeS && normalise(treeS, 6, "y")].filter((m): m is Group => Boolean(m)),
    lamp: lamp && normalise(lamp, 8, "y"),
    rail: rail && normalise(rail, 4, "long"),
    cone: cone && normalise(cone, 0.9, "y"),
    flag: flag && normalise(flag, 5, "y"),
  };
}

export const CHUNK = 240; // metres of road per instanced chunk

export interface Instance {
  /** Distance along the road, used to sort the instance into a chunk. */
  s: number;
  matrix: Matrix4;
}

/**
 * Like `instancedFrom`, but split into chunks of CHUNK metres of road. Each chunk is its own
 * InstancedMesh with a real bounding sphere (so three.js frustum-culls it) and an `[s0, s1]` range in
 * `userData`, which the renderer uses to hide chunks beyond the fog. Without this, every tree and rail on
 * the whole 6 km route would be vertex-processed every frame.
 */
export function instancedChunks(model: Object3D, items: Instance[]): InstancedMesh[] {
  const byChunk = new Map<number, Matrix4[]>();
  for (const it of items) {
    const k = Math.floor(it.s / CHUNK);
    const list = byChunk.get(k);
    if (list) list.push(it.matrix);
    else byChunk.set(k, [it.matrix]);
  }
  const out: InstancedMesh[] = [];
  for (const [k, matrices] of byChunk) {
    for (const mesh of instancedFrom(model, matrices).children as InstancedMesh[]) {
      mesh.frustumCulled = true;
      mesh.computeBoundingSphere();
      mesh.userData.s0 = k * CHUNK;
      mesh.userData.s1 = (k + 1) * CHUNK;
      out.push(mesh);
    }
  }
  return out;
}

/**
 * One InstancedMesh per mesh in `model`, placed at every transform. `transforms`
 * are world matrices for the model's origin; each mesh's own offset within the
 * model is baked in.
 */
export function instancedFrom(model: Object3D, transforms: Matrix4[]): Group {
  const group = new Group();
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const inst = new InstancedMesh(mesh.geometry, mesh.material, transforms.length);
    const m = new Matrix4();
    transforms.forEach((t, i) => inst.setMatrixAt(i, m.multiplyMatrices(t, mesh.matrixWorld)));
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false; // spans the whole route
    group.add(inst);
  });
  return group;
}
