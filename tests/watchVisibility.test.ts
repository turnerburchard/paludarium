import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { WatchVisibility } from "../src/scene/watchVisibility";

function leaf(z: number, x = 0) {
  const leaf = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }),
  );
  leaf.position.set(x, 0, z);
  leaf.castShadow = true;
  leaf.updateMatrixWorld(true);
  return leaf;
}
const eye = new THREE.Vector3(0, 0, 3);
const focus = new THREE.Vector3();
const right = new THREE.Vector3(1, 0, 0);
const up = new THREE.Vector3(0, 1, 0);

describe("watch visibility", () => {
  it("fades every layer in front of the body, leaving its perch and background alone", () => {
    const front = leaf(1),
      middle = leaf(0.5),
      perch = leaf(0.05),
      behind = leaf(-1),
      side = leaf(1, 1);
    const foliage = [front, middle, perch, behind, side];
    const visibility = new WatchVisibility();
    for (let frame = 0; frame < 60; frame++)
      visibility.update(eye, focus, right, up, foliage, 1 / 60);
    expect(front.material.opacity).toBeCloseTo(0.08, 2);
    expect(middle.material.opacity).toBeCloseTo(0.08, 2);
    expect(front.material.depthWrite).toBe(false);
    expect(front.castShadow).toBe(false);
    for (const leaf of [perch, behind, side])
      expect(leaf.material.opacity).toBe(1);
    visibility.restore();
    expect(front.material.opacity).toBe(1);
    expect(front.material.transparent).toBe(false);
    expect(front.material.depthWrite).toBe(true);
    expect(front.castShadow).toBe(true);
  });

  it("restores foliage as the camera or frog moves away", () => {
    const front = leaf(1);
    const visibility = new WatchVisibility();
    for (let frame = 0; frame < 30; frame++)
      visibility.update(eye, focus, right, up, [front], 1 / 60);
    expect(front.material.opacity).toBeLessThan(0.1);
    for (let frame = 0; frame < 60; frame++)
      visibility.update(
        new THREE.Vector3(3, 0, 0),
        focus,
        right,
        up,
        [front],
        1 / 60,
      );
    expect(front.material.opacity).toBe(1);
    expect(front.material.transparent).toBe(false);
    expect(front.castShadow).toBe(true);
  });

  it("restores original material settings rather than assuming opaque foliage", () => {
    const front = leaf(1);
    front.material.opacity = 0.5;
    front.material.transparent = true;
    front.material.depthWrite = false;
    front.castShadow = false;
    const visibility = new WatchVisibility();
    visibility.update(eye, focus, right, up, [front], 0.1);
    visibility.restore();
    expect(front.material.opacity).toBe(0.5);
    expect(front.material.transparent).toBe(true);
    expect(front.material.depthWrite).toBe(false);
    expect(front.castShadow).toBe(false);
  });
});
