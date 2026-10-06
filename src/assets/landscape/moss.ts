import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ringVolume, triangles, type Point } from "../faceted";
import type { AssetDefinition } from "../types";

export const moss: AssetDefinition = {
  kind: "moss",
  name: "Moss cushion",
  category: "Landscape",
  description: "A soft patch of green to tuck between stones.",
  radius: 0.4,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const outline = Array.from({ length: 12 }, (_, i) => ({
    angle: (i * Math.PI) / 6,
    radius: 0.29 + random() * 0.08,
  }));
  const rings = [
    outline.map(
      ({ angle, radius }): Point => [
        Math.cos(angle) * radius,
        0.002,
        Math.sin(angle) * radius,
      ],
    ),
    outline.map(
      ({ angle, radius }): Point => [
        Math.cos(angle) * radius,
        0.008 + random() * 0.007,
        Math.sin(angle) * radius,
      ],
    ),
    outline.map(
      ({ angle, radius }): Point => [
        Math.cos(angle) * radius * 0.48,
        0.025 + random() * 0.016,
        Math.sin(angle) * radius * 0.48,
      ],
    ),
    outline.map(
      ({ angle }): Point => [
        Math.cos(angle) * 0.018,
        0.028,
        Math.sin(angle) * 0.018,
      ],
    ),
  ];
  const surface = ringVolume(rings);
  const positions = surface.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const palette = ["#50672b", "#617b31", "#718736"].map(
    (c) => new THREE.Color(c),
  );
  for (let i = 0; i < positions.count; i += 3) {
    const color = palette[Math.floor(random() * palette.length)];
    for (let j = 0; j < 3; j++)
      colors.set([color.r, color.g, color.b], (i + j) * 3);
  }
  surface.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = material("#ffffff", 0.95);
  mat.vertexColors = true;
  mesh(surface, mat, root);
  const fronds = material("#82964b", 0.95);
  for (let tuft = 0; tuft < 22; tuft++) {
    const a = random() * Math.PI * 2,
      radius = Math.sqrt(random()) * 0.28;
    const x = Math.cos(a) * radius,
      z = Math.sin(a) * radius;
    const y = 0.03 - radius * 0.055;
    for (let leaf = 0; leaf < 3; leaf++) {
      const angle = a + leaf * 2.1;
      const length = 0.022 + random() * 0.034;
      mesh(
        triangles(
          [
            [x, y, z],
            [
              x + Math.cos(angle) * length,
              y + length * 0.65,
              z + Math.sin(angle) * length,
            ],
            [
              x - Math.sin(angle) * 0.008,
              y + 0.014,
              z + Math.cos(angle) * 0.008,
            ],
            [
              x + Math.sin(angle) * 0.008,
              y + 0.014,
              z - Math.cos(angle) * 0.008,
            ],
          ],
          [0, 2, 1, 0, 1, 3],
        ),
        fronds,
        root,
      );
    }
  }
  return root;
}
