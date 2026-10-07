import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ringVolume, type Point } from "../faceted";
import type { AssetDefinition } from "../types";

export const spruce: AssetDefinition = {
  kind: "spruce",
  name: "Blue spruce seedling",
  scientificName: "Picea pungens",
  group: "Leafy plants",
  biomes: ["Temperate"],
  description:
    "A young spruce, stiff and silvery blue-green, growing in tiers along a mountain stream.",
  radius: 0.3,
  habitat: "land",
  shelter: true,
  soil: "drained",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const height = 0.6 + random() * 0.25;
  const bark = material("#5a4130", 0.9);
  mesh(new THREE.CylinderGeometry(0.012, 0.02, height * 0.4, 5), bark, root, [
    0,
    height * 0.2,
    0,
  ]);
  const needles = [
    material("#4f7468"),
    material("#5f8678"),
    material("#46685c"),
  ];
  // Overlapping tiers, widest at the bottom, each with a ragged lower edge.
  const tiers = 5;
  for (let t = 0; t < tiers; t++) {
    const base = height * (0.12 + (t / tiers) * 0.72);
    const width = 0.21 * (1 - t / tiers) + 0.04;
    const tall = height * 0.3;
    const twist = random() * Math.PI;
    const ring = (y: number, r: number, jag: number) =>
      Array.from({ length: 9 }, (_, side): Point => {
        const a = (side * Math.PI * 2) / 9 + twist;
        const radius = r * (1 + (side % 2 ? jag : -jag));
        return [
          Math.cos(a) * radius,
          y + (side % 2 ? -jag * 0.3 : 0),
          Math.sin(a) * radius,
        ];
      });
    mesh(
      ringVolume([
        ring(base, width * 0.3, 0),
        ring(base + 0.01, width, 0.12),
        ring(base + tall * 0.5, width * 0.45, 0.06),
        ring(base + tall, 0.004, 0),
      ]),
      needles[t % needles.length],
      root,
    );
  }
  return root;
}
