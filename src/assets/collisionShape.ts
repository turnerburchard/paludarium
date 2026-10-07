import * as THREE from "three";
import { buildAsset, disposeAsset } from "./index";
import type { HabitatObject } from "../model/schema";

export interface CollisionFace {
  triangle: THREE.Triangle;
  bounds: THREE.Box3;
}

const shapes = new WeakMap<
  HabitatObject,
  { faces: CollisionFace[]; bounds: THREE.Box3; parts: THREE.Box3[] }
>();

/** Only baked geometry survives; these models never enter the scene. Moss
 * painted onto hardscape is soft cover rather than another solid surface. */
export function collisionShape(object: HabitatObject) {
  const cached = shapes.get(object);
  if (cached) return cached;
  const model = buildAsset(object.kind, object.seed);
  model.updateMatrixWorld(true);
  const faces: CollisionFace[] = [];
  const bounds = new THREE.Box3();
  const groups = new Map<string, THREE.Box3>();
  model.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    const positions = part.geometry.getAttribute("position");
    const index = part.geometry.index;
    const count = index?.count ?? positions.count;
    const skinIndex = part.geometry.getAttribute("skinIndex");
    const skinWeight = part.geometry.getAttribute("skinWeight");
    for (let i = 0; i < count; i += 3) {
      const points = [0, 1, 2].map((offset) =>
        new THREE.Vector3()
          .fromBufferAttribute(
            positions,
            index ? index.getX(i + offset) : i + offset,
          )
          .applyMatrix4(part.matrixWorld),
      );
      const triangle = new THREE.Triangle(points[0], points[1], points[2]);
      const box = new THREE.Box3().setFromPoints(points);
      faces.push({ triangle, bounds: box });
      bounds.union(box);
      // Group skinned faces by their strongest bone. This leaves the space
      // between limbs open without needing a collision mesh for every pose.
      const weights = new Map<number, number>();
      if (skinIndex && skinWeight)
        for (let corner = 0; corner < 3; corner++) {
          const vertex = index ? index.getX(i + corner) : i + corner;
          for (let influence = 0; influence < 4; influence++) {
            const bone = skinIndex.getComponent(vertex, influence);
            weights.set(
              bone,
              (weights.get(bone) ?? 0) +
                skinWeight.getComponent(vertex, influence),
            );
          }
        }
      let bone = 0,
        weight = -1;
      for (const [candidate, amount] of weights)
        if (amount > weight) {
          bone = candidate;
          weight = amount;
        }
      const name =
        part instanceof THREE.SkinnedMesh
          ? part.skeleton.bones[bone].name
          : String(part.id);
      const key =
        skinIndex &&
        !/leg|hip|foot|arm|hand|thigh|shin|tail|knee|tip/i.test(name)
          ? "trunk"
          : name;
      const group = groups.get(key) ?? new THREE.Box3();
      group.union(box);
      groups.set(key, group);
    }
  });
  const tail = model.getObjectByName("tail");
  if (tail)
    for (const angle of [-0.35, 0.35]) {
      tail.rotation.y = angle;
      bounds.union(new THREE.Box3().setFromObject(model));
    }
  disposeAsset(model);
  const result = { faces, bounds, parts: [...groups.values()] };
  shapes.set(object, result);
  return result;
}

export interface CollisionTree {
  bounds: THREE.Box3;
  faces?: CollisionFace[];
  children?: [CollisionTree, CollisionTree];
}

export function collisionTree(faces: CollisionFace[]): CollisionTree {
  const bounds = new THREE.Box3();
  for (const face of faces) bounds.union(face.bounds);
  if (faces.length <= 12) return { bounds, faces };
  const size = bounds.getSize(new THREE.Vector3());
  const axis =
    size.x > size.y && size.x > size.z ? "x" : size.y > size.z ? "y" : "z";
  faces.sort(
    (a, b) =>
      a.bounds.min[axis] +
      a.bounds.max[axis] -
      b.bounds.min[axis] -
      b.bounds.max[axis],
  );
  const middle = Math.floor(faces.length / 2);
  return {
    bounds,
    children: [
      collisionTree(faces.slice(0, middle)),
      collisionTree(faces.slice(middle)),
    ],
  };
}

export function* collisionFaces(
  tree: CollisionTree,
  query: THREE.Box3 | THREE.Ray,
): Generator<CollisionFace> {
  if (!query.intersectsBox(tree.bounds)) return;
  if (tree.faces) {
    for (const face of tree.faces)
      if (query.intersectsBox(face.bounds)) yield face;
  } else {
    for (const child of tree.children!) yield* collisionFaces(child, query);
  }
}
