import * as THREE from "three";
import { material, mesh, ellipsoid } from "./geometry";

export function fish() {
  const root = new THREE.Group(),
    gold = material("#edab52", 0.4),
    fin = material("#dd7841"),
    dark = material("#182a27");
  ellipsoid(root, gold, [0, 0, 0], [0.1, 0.12, 0.23]);
  const tail = mesh(
    new THREE.ConeGeometry(0.13, 0.22, 3),
    fin,
    root,
    [0, 0, 0.29],
  );
  tail.rotation.x = -Math.PI / 2;
  tail.scale.z = 0.2;
  tail.name = "tail";
  for (const side of [-1, 1]) {
    ellipsoid(
      root,
      dark,
      [side * 0.078, 0.033, -0.14],
      [0.015, 0.018, 0.019],
      8,
    );
    const f = ellipsoid(
      root,
      fin,
      [side * 0.11, -0.025, 0.015],
      [0.075, 0.013, 0.1],
    );
    f.rotation.z = side * 0.35;
  }
  return root;
}
