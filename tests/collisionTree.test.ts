import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildCollisionTree, visitRayFaces } from "../src/assets/collisionTree";
import type { CollisionFace } from "../src/assets/collisionShape";
import { randomFromSeed } from "../src/model/random";

function boxes(): CollisionFace[] {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const positions = geometry.getAttribute("position");
  const faces: CollisionFace[] = [];
  for (let box = 0; box < 20; box++)
    for (let i = 0; i < geometry.index!.count; i += 3) {
      const points = [0, 1, 2].map((offset) =>
        new THREE.Vector3()
          .fromBufferAttribute(positions, geometry.index!.getX(i + offset))
          .add(new THREE.Vector3(box * 2 - 20, 0, 0)),
      );
      const triangle = new THREE.Triangle(points[0], points[1], points[2]);
      faces.push({ triangle, bounds: new THREE.Box3().setFromPoints(points) });
    }
  geometry.dispose();
  return faces;
}

describe("collision face index", () => {
  it("retains every ray intersection, including shared edges and vertices", () => {
    const faces = boxes();
    const tree = buildCollisionTree(faces);
    const random = randomFromSeed(173);
    const rays = Array.from(
      { length: 100 },
      () =>
        new THREE.Ray(
          new THREE.Vector3(random() * 45 - 22, random() * 4 - 2, 4),
          new THREE.Vector3(random() - 0.5, random() - 0.5, -1).normalize(),
        ),
    );
    for (const x of [-20.5, -20, -19.5])
      for (const y of [-0.5, 0, 0.5])
        rays.push(
          new THREE.Ray(
            new THREE.Vector3(x, y, 4),
            new THREE.Vector3(0, 0, -1),
          ),
        );
    for (const ray of rays) {
      const hit = new THREE.Vector3();
      const intersects = (face: CollisionFace) =>
        !!ray.intersectTriangle(
          face.triangle.a,
          face.triangle.b,
          face.triangle.c,
          false,
          hit,
        );
      const actual: CollisionFace[] = [];
      visitRayFaces(tree, ray, (face) => {
        if (intersects(face)) actual.push(face);
      });
      expect(new Set(actual)).toEqual(new Set(faces.filter(intersects)));
    }
  });

  it("skips distant triangles instead of visiting the entire mesh", () => {
    const faces = boxes();
    const tree = buildCollisionTree(faces);
    const candidates: CollisionFace[] = [];
    visitRayFaces(
      tree,
      new THREE.Ray(new THREE.Vector3(-20, 0, 4), new THREE.Vector3(0, 0, -1)),
      (face) => candidates.push(face),
    );
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThan(faces.length / 10);
  });
});
