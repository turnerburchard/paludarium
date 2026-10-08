import * as THREE from "three";
import type { CollisionFace } from "./collisionShape";

export interface CollisionTree {
  bounds: THREE.Box3;
  faces?: CollisionFace[];
  children?: [CollisionTree, CollisionTree];
}

export function buildCollisionTree(faces: CollisionFace[]): CollisionTree {
  // Twice each face's center, for splitting along whichever axis is longest.
  const centers = faces.map(({ bounds }) => ({
    x: bounds.min.x + bounds.max.x,
    y: bounds.min.y + bounds.max.y,
    z: bounds.min.z + bounds.max.z,
  }));
  const order = faces.map((_, index) => index);
  const build = (start: number, end: number): CollisionTree => {
    const bounds = new THREE.Box3();
    for (let i = start; i < end; i++) bounds.union(faces[order[i]].bounds);
    if (end - start <= 12)
      return {
        bounds,
        faces: order.slice(start, end).map((index) => faces[index]),
      };
    const size = bounds.getSize(new THREE.Vector3());
    const axis =
      size.x > size.y && size.x > size.z ? "x" : size.y > size.z ? "y" : "z";
    const middle = Math.floor((start + end) / 2);
    // Only the halves matter, so partition around the median rather than
    // sorting every level.
    select(order, (index) => centers[index][axis], start, end - 1, middle);
    return { bounds, children: [build(start, middle), build(middle, end)] };
  };
  return build(0, faces.length);
}

/** Reorders `order[left..right]` so the `k`th smallest key is at `k`, with
 * smaller keys before it and larger ones after. */
function select(
  order: number[],
  key: (index: number) => number,
  left: number,
  right: number,
  k: number,
) {
  while (left < right) {
    const pivot = key(order[(left + right) >> 1]);
    let i = left,
      j = right;
    while (i <= j) {
      while (key(order[i]) < pivot) i++;
      while (key(order[j]) > pivot) j--;
      if (i <= j) {
        [order[i], order[j]] = [order[j], order[i]];
        i++;
        j--;
      }
    }
    if (k <= j) right = j;
    else if (k >= i) left = i;
    else return;
  }
}

export function visitRayFaces(
  tree: CollisionTree,
  ray: THREE.Ray,
  visit: (face: CollisionFace) => void,
) {
  if (!ray.intersectsBox(tree.bounds)) return;
  if (tree.children) {
    for (const child of tree.children) visitRayFaces(child, ray, visit);
  } else {
    for (const face of tree.faces!)
      if (ray.intersectsBox(face.bounds)) visit(face);
  }
}
