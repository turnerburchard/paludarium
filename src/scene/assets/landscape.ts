import * as THREE from "three";
import { material, mesh, branch, curvedStem, ellipsoid } from "./geometry";

export function rock(random: () => number) {
  const root = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.47, 2),
    positions = geo.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const rough = 1 + 0.13 * Math.sin(x * 21 + z * 9) * Math.cos(y * 17);
    positions.setXYZ(
      i,
      x * rough * 1.1,
      Math.max(-0.22, y * rough * 0.85),
      z * rough * 0.8,
    );
  }
  geo.computeVertexNormals();
  const stone = material(
    new THREE.Color().setHSL(0.13, 0.075, 0.23 + random() * 0.1),
  );
  stone.flatShading = true;
  mesh(geo, stone, root, [0, 0.22, 0]);
  return root;
}
export function moss(random: () => number) {
  const root = new THREE.Group(),
    green = [material("#536c28"), material("#677f32"), material("#748b36")];
  for (let i = 0; i < 18; i++) {
    const a = random() * Math.PI * 2,
      r = Math.sqrt(random()) * 0.38;
    ellipsoid(
      root,
      green[i % 3],
      [Math.cos(a) * r, 0.045, Math.sin(a) * r],
      [0.13 + random() * 0.07, 0.06 + random() * 0.04, 0.11],
      10,
    );
  }
  return root;
}
export function wood() {
  const root = new THREE.Group(),
    bark = material("#69523c"),
    cut = material("#a4875c");
  const start = new THREE.Vector3(-0.58, 0.12, 0),
    end = new THREE.Vector3(0.5, 0.22, 0.08);
  branch(root, start, end, 0.13, bark, 0.09);
  branch(
    root,
    new THREE.Vector3(-0.15, 0.17, 0),
    new THREE.Vector3(0.25, 0.52, -0.3),
    0.065,
    bark,
    0.026,
  );
  branch(
    root,
    new THREE.Vector3(0.18, 0.2, 0.04),
    new THREE.Vector3(0.62, 0.15, 0.38),
    0.045,
    bark,
    0.018,
  );
  const cap = mesh(new THREE.CircleGeometry(0.087, 12), cut, root, end);
  cap.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    end.clone().sub(start).normalize(),
  );
  for (let i = 0; i < 4; i++)
    curvedStem(
      root,
      [
        new THREE.Vector3(-0.5, 0.13 + i * 0.035, 0.1),
        new THREE.Vector3(0, 0.22 + i * 0.023, 0.12),
        new THREE.Vector3(0.44, 0.22 + i * 0.015, 0.13),
      ],
      0.007,
      cut,
    );
  return root;
}
