import * as THREE from "three";
import { material, mesh, branch, blade, ellipsoid } from "../geometry";
import { ringVolume, triangles, type Point } from "../faceted";
import type { AssetDefinition } from "../types";

export const strawberry: AssetDefinition = {
  kind: "strawberry",
  name: "Wild strawberry",
  scientificName: "Fragaria vesca",
  group: "Leafy plants",
  biomes: ["Temperate"],
  description:
    "A low-growing strawberry native to Europe and Asia, with white flowers and small red berries.",
  radius: 0.34,
  habitat: "land",
  shelter: true,
  soil: "drained",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#526d2f"),
    green = material("#3e783a"),
    white = material("#fff9df"),
    yellow = material("#eacb65"),
    red = material("#cc3c32", 0.75);
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
        true,
      );
    if (i % 2 === 0) {
      const profile = [
        [-0.085, 0.003],
        [-0.03, 0.045],
        [0.025, 0.072],
        [0.065, 0.057],
        [0.078, 0.025],
      ];
      const berryRings = profile.map(([y, radius]) =>
        Array.from({ length: 7 }, (_, side): Point => {
          const a = (side * Math.PI * 2) / 7;
          return [Math.cos(a) * radius, y, Math.sin(a) * radius];
        }),
      );
      const berry = mesh(ringVolume(berryRings), red, root, [
        point.x * 1.25,
        0.12,
        point.z * 1.25,
      ]);
      berry.rotation.z = 0.2;
      for (let s = 0; s < 9; s++) {
        const a = s * 2.4,
          y = (s / 9 - 0.5) * 0.13;
        const lowerIndex = profile.findIndex(
          (section, i) =>
            i < profile.length - 1 && y >= section[0] && y <= profile[i + 1][0],
        );
        const [lowY, lowRadius] = profile[lowerIndex];
        const [highY, highRadius] = profile[lowerIndex + 1];
        const radius = THREE.MathUtils.lerp(
          lowRadius,
          highRadius,
          (y - lowY) / (highY - lowY),
        );
        const halfFace = Math.PI / 7;
        const faceAngle = ((a + halfFace) % (halfFace * 2)) - halfFace;
        const surfaceRadius =
          (radius * Math.cos(halfFace)) / Math.cos(faceAngle) + 0.002;
        ellipsoid(
          berry,
          yellow,
          [Math.cos(a) * surfaceRadius, y, Math.sin(a) * surfaceRadius],
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
        const forward = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const sideways = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
        const tip = center
          .clone()
          .addScaledVector(forward, 0.085)
          .setY(center.y + 0.008);
        const left = center
          .clone()
          .addScaledVector(forward, 0.046)
          .addScaledVector(sideways, 0.029);
        const right = center
          .clone()
          .addScaledVector(forward, 0.046)
          .addScaledVector(sideways, -0.029);
        mesh(
          triangles(
            [center.toArray(), left.toArray(), tip.toArray(), right.toArray()],
            [0, 1, 2, 0, 2, 3],
          ),
          white,
          root,
        );
      }
      ellipsoid(
        root,
        yellow,
        [center.x, center.y + 0.012, center.z],
        [0.024, 0.017, 0.024],
        6,
      );
    }
  }
  return root;
}
