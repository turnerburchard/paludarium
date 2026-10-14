import * as THREE from "three";
import { assets, buildAssetSteps, disposeAsset } from "./index";
import { randomFromSeed } from "../model/random";
import type { HabitatObject } from "../model/schema";
import { finishWork } from "../work";

export interface CollisionFace {
  triangle: THREE.Triangle;
  bounds: THREE.Box3;
}

interface Shape {
  faces: CollisionFace[];
  bounds: THREE.Box3;
}

const shapes = new WeakMap<HabitatObject, Shape>();

const structures = new WeakMap<HabitatObject, Shape>();

/** Structure is built separately so render batching cannot mix leaves into
 * stems. Whole-model blockers reuse the ordinary shape. */
export function structuralShape(object: HabitatObject) {
  return finishWork(structuralShapeSteps(object));
}

export function* structuralShapeSteps(
  object: HabitatObject,
): Generator<void, Shape> {
  const asset = assets[object.kind];
  if (!asset.buildStructure) return yield* collisionShapeSteps(object);
  const cached = structures.get(object);
  if (cached) return cached;
  const model = asset.buildStructure(randomFromSeed(object.seed));
  model.scale.multiplyScalar(asset.size ?? 1);
  const shape = yield* geometryShapeSteps(model);
  structures.set(object, shape);
  return shape;
}

/** Only baked geometry survives; these models never enter the scene. Moss
 * painted onto hardscape is soft cover rather than another solid surface. */
export function collisionShape(object: HabitatObject) {
  return finishWork(collisionShapeSteps(object));
}

export function* collisionShapeSteps(
  object: HabitatObject,
): Generator<void, Shape> {
  const cached = shapes.get(object);
  if (cached) return cached;
  const result = yield* geometryShapeSteps(
    yield* buildAssetSteps(object.kind, object.seed),
  );
  shapes.set(object, result);
  return result;
}

function* geometryShapeSteps(model: THREE.Group): Generator<void, Shape> {
  try {
    model.updateMatrixWorld(true);
    const faces: CollisionFace[] = [];
    const bounds = new THREE.Box3();
    const meshes: THREE.Mesh[] = [];
    model.traverse((part) => {
      if (part instanceof THREE.Mesh) meshes.push(part);
    });
    for (const part of meshes) {
      const positions = part.geometry.getAttribute("position");
      const index = part.geometry.index;
      const count = index?.count ?? positions.count;
      for (let i = 0; i < count; i += 3) {
        if (i % 384 === 0) yield;
        const points = [0, 1, 2].map((offset) =>
          new THREE.Vector3()
            .fromBufferAttribute(
              positions,
              index ? index.getX(i + offset) : i + offset,
            )
            .applyMatrix4(part.matrixWorld),
        );
        const triangle = new THREE.Triangle(points[0], points[1], points[2]);
        if (triangle.getArea() < 1e-10) continue;
        const box = new THREE.Box3().setFromPoints(points);
        faces.push({ triangle, bounds: box });
        bounds.union(box);
      }
    }
    const tail = model.getObjectByName("tail");
    if (tail)
      for (const angle of [-0.35, 0.35]) {
        tail.rotation.y = angle;
        bounds.union(new THREE.Box3().setFromObject(model));
      }
    return { faces, bounds };
  } finally {
    disposeAsset(model);
  }
}

/** Instance transforms are identical for navigation, contact and foliage. */
export function placeShape(
  shape: ReturnType<typeof collisionShape>,
  object: HabitatObject,
  baseY: number,
) {
  return finishWork(placeShapeSteps(shape, object, baseY));
}

export function* placeShapeSteps(
  shape: Shape,
  object: HabitatObject,
  baseY: number,
): Generator<void, Shape> {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(object.x, baseY, object.z),
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      object.rotation,
    ),
    new THREE.Vector3().setScalar(object.scale),
  );
  const faces: CollisionFace[] = [];
  for (let i = 0; i < shape.faces.length; i++) {
    if (i % 128 === 0) yield;
    const { triangle } = shape.faces[i];
    const moved = triangle.clone();
    for (const point of [moved.a, moved.b, moved.c]) point.applyMatrix4(matrix);
    faces.push({
      triangle: moved,
      bounds: new THREE.Box3().setFromPoints([moved.a, moved.b, moved.c]),
    });
  }
  return { faces, bounds: shape.bounds.clone().applyMatrix4(matrix) };
}
