import * as THREE from "three";
import type { CollisionFace } from "./collisionShape";

export interface CollisionTree {
  bounds: THREE.Box3;
  faces?: CollisionFace[];
  children?: [CollisionTree, CollisionTree];
}

export function buildCollisionTree(faces: CollisionFace[]): CollisionTree {
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
      buildCollisionTree(faces.slice(0, middle)),
      buildCollisionTree(faces.slice(middle)),
    ],
  };
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

export function* collisionFaces(
  tree: CollisionTree,
  query: THREE.Box3,
): Generator<CollisionFace> {
  if (!query.intersectsBox(tree.bounds)) return;
  if (tree.faces) {
    for (const face of tree.faces)
      if (query.intersectsBox(face.bounds)) yield face;
  } else {
    for (const child of tree.children!) yield* collisionFaces(child, query);
  }
}
