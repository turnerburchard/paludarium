import * as THREE from "three";
import { buildAsset, disposeAsset } from "./index";
import type { HabitatObject } from "../model/schema";

export interface CollisionFace {
  triangle: THREE.Triangle;
  bounds: THREE.Box3;
}

const shapes = new WeakMap<
  HabitatObject,
  { faces: CollisionFace[]; bounds: THREE.Box3 }
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
  model.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    const positions = part.geometry.getAttribute("position");
    const index = part.geometry.index;
    const count = index?.count ?? positions.count;
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
    }
  });
  const tail = model.getObjectByName("tail");
  if (tail)
    for (const angle of [-0.35, 0.35]) {
      tail.rotation.y = angle;
      bounds.union(new THREE.Box3().setFromObject(model));
    }
  disposeAsset(model);
  const result = { faces, bounds };
  shapes.set(object, result);
  return result;
}
