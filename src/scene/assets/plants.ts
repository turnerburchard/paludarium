import * as THREE from "three";
import { material, branch, curvedStem, blade, ellipsoid } from "./geometry";

export function monstera(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#507139");
  const greens = ["#245c36", "#337a43", "#458d4d", "#265f38"];
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.399 + random() * 0.3,
      height = 0.7 + random() * 0.95;
    const tip = new THREE.Vector3(
      Math.cos(angle) * (0.25 + height * 0.23),
      height,
      Math.sin(angle) * (0.25 + height * 0.23),
    );
    curvedStem(
      root,
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(tip.x * 0.2, height * 0.6, tip.z * 0.2),
        tip,
      ],
      0.022,
      stem,
    );
    const direction = new THREE.Vector3(
      Math.cos(angle) * 0.85,
      0.15 + random() * 0.35,
      Math.sin(angle) * 0.85,
    );
    const leaf = blade(
      root,
      tip,
      direction,
      0.65 + height * 0.15,
      0.68,
      material(greens[i % 4]),
      true,
    );
    // A raised midrib catches the light and makes the simplified foliage read as a plant.
    curvedStem(
      leaf,
      [
        new THREE.Vector3(0, 0, 0.005),
        new THREE.Vector3(0, 0.35, 0.13),
        new THREE.Vector3(0, 0.72, 0.02),
      ],
      0.006,
      stem,
    );
  }
  return root;
}
export function fern(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#536f2d"),
    greens = [material("#568d3e"), material("#357345"), material("#6d9e48")];
  for (let i = 0; i < 9; i++) {
    const angle = (i * Math.PI * 2) / 9 + random() * 0.2,
      length = 0.7 + random() * 0.5;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const points = Array.from({ length: 9 }, (_, j) =>
      direction
        .clone()
        .multiplyScalar((j / 8) * length * 0.73)
        .setY(
          Math.sin((j / 8) * Math.PI * 0.86) * length * 0.7 + (j / 8) * 0.06,
        ),
    );
    curvedStem(root, points, 0.009, stem);
    for (let j = 1; j < 8; j++)
      for (const side of [-1, 1]) {
        const t = j / 8,
          p = points[j];
        const tangent = new THREE.Vector3(
          -Math.sin(angle) * side,
          0.12,
          Math.cos(angle) * side,
        ).addScaledVector(direction, 0.3);
        blade(
          root,
          p,
          tangent,
          (1 - t) * 0.31 + 0.04,
          0.12,
          greens[(i + j) % 3],
        );
      }
  }
  return root;
}
export function strawberry(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#526d2f"),
    green = material("#3e783a"),
    white = material("#fff9df"),
    yellow = material("#eacb65"),
    red = material("#cc3c32", 0.4);
  for (let i = 0; i < 6; i++) {
    const angle = i * 2.4,
      height = 0.18 + random() * 0.18;
    const point = new THREE.Vector3(
      Math.cos(angle) * 0.28,
      height,
      Math.sin(angle) * 0.28,
    );
    branch(root, new THREE.Vector3(), point, 0.009, stem);
    for (let k = -1; k <= 1; k++)
      blade(
        root,
        point,
        new THREE.Vector3(
          Math.cos(angle + k * 0.8),
          0.45,
          Math.sin(angle + k * 0.8),
        ),
        0.27,
        0.23,
        green,
        false,
        true,
      );
    if (i % 2 === 0) {
      const berry = ellipsoid(
        root,
        red,
        [point.x * 1.25, 0.12, point.z * 1.25],
        [0.074, 0.1, 0.074],
      );
      berry.rotation.z = 0.2;
      for (let s = 0; s < 9; s++) {
        const a = s * 2.4,
          y = (s / 9 - 0.5) * 0.13;
        ellipsoid(
          root,
          yellow,
          [
            point.x * 1.25 + Math.cos(a) * 0.071,
            0.12 + y,
            point.z * 1.25 + Math.sin(a) * 0.071,
          ],
          [0.005, 0.008, 0.004],
          6,
        );
      }
    } else {
      const center = point
        .clone()
        .multiplyScalar(0.8)
        .setY(height + 0.13);
      branch(root, point, center, 0.006, stem);
      for (let p = 0; p < 5; p++) {
        const a = (p * Math.PI * 2) / 5;
        ellipsoid(
          root,
          white,
          [
            center.x + Math.cos(a) * 0.05,
            center.y,
            center.z + Math.sin(a) * 0.05,
          ],
          [0.041, 0.012, 0.036],
        );
      }
      ellipsoid(
        root,
        yellow,
        [center.x, center.y + 0.012, center.z],
        [0.024, 0.017, 0.024],
      );
    }
  }
  return root;
}
export function bromeliad(random: () => number) {
  const root = new THREE.Group();
  const leaves = [
    material("#366d40"),
    material("#487a41"),
    material("#8caa54"),
  ];
  for (let i = 0; i < 13; i++) {
    const a = i * 2.4;
    blade(
      root,
      new THREE.Vector3(0, 0.03, 0),
      new THREE.Vector3(
        Math.cos(a) * 0.7,
        0.3 + random() * 0.5,
        Math.sin(a) * 0.7,
      ),
      0.6 + random() * 0.2,
      0.16,
      leaves[i % 3],
    );
  }
  const flower = material("#e46747"),
    tip = material("#f2a263");
  branch(
    root,
    new THREE.Vector3(),
    new THREE.Vector3(0, 0.62, 0),
    0.02,
    flower,
  );
  for (let i = 0; i < 8; i++) {
    const a = i * 2.4;
    blade(
      root,
      new THREE.Vector3(0, 0.4 + i * 0.03, 0),
      new THREE.Vector3(Math.cos(a) * 0.7, 0.9, Math.sin(a) * 0.7),
      0.22,
      0.12,
      i % 2 ? flower : tip,
    );
  }
  return root;
}
export function grass(random: () => number) {
  const root = new THREE.Group(),
    colors = [material("#718b3d"), material("#829e48"), material("#486d37")];
  for (let i = 0; i < 28; i++) {
    const a = random() * Math.PI * 2;
    blade(
      root,
      new THREE.Vector3((random() - 0.5) * 0.12, 0, (random() - 0.5) * 0.12),
      new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5),
      0.35 + random() * 0.5,
      0.035,
      colors[i % 3],
    );
  }
  return root;
}
