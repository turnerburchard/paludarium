import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ringVolume, type Point } from "../faceted";
import type { AssetDefinition } from "../types";

export const barrelCactus: AssetDefinition = {
  kind: "barrel-cactus",
  name: "Barrel cactus",
  scientificName: "Ferocactus cylindraceus",
  group: "Cacti & succulents",
  biomes: ["Desert"],
  description:
    "A stout, ribbed barrel armored in red-gold spines, crowned with yellow flowers in spring.",
  radius: 0.2,
  size: 2.2,
  habitat: "land",
  blocksMovement: true,
  soil: "arid",
  build,
};

const RIBS = 14;

function build(random: () => number) {
  const root = new THREE.Group();
  const height = 0.22 + random() * 0.14,
    width = 0.11 + random() * 0.03;
  const lean = (random() - 0.5) * 0.15;
  // Alternating radii make the ribs; the profile swells and rounds at the top.
  const profile = [
    [0, 0.8],
    [0.15, 1],
    [0.55, 1.02],
    [0.85, 0.85],
    [0.97, 0.45],
    [1, 0.1],
  ];
  const rings = profile.map(([t, r]) =>
    Array.from({ length: RIBS * 2 }, (_, side): Point => {
      const a = (side * Math.PI) / RIBS;
      const radius = width * r * (side % 2 ? 0.86 : 1);
      return [
        Math.cos(a) * radius + lean * t * height,
        t * height,
        Math.sin(a) * radius,
      ];
    }),
  );
  mesh(ringVolume(rings), material("#5f7f4f", 0.8), root);
  const spine = material("#c9744a", 0.6);
  for (let rib = 0; rib < RIBS; rib++) {
    const a = (rib * 2 * Math.PI) / RIBS;
    for (const [t, r] of profile.slice(1, 4)) {
      const radius = width * r + 0.01;
      const s = mesh(new THREE.ConeGeometry(0.006, 0.035, 3), spine, root, [
        Math.cos(a) * radius + lean * t * height,
        t * height,
        Math.sin(a) * radius,
      ]);
      s.rotation.set(0, -a, -Math.PI / 2 + 0.4);
    }
  }
  const bloom = material("#e8c43d", 0.6);
  for (let f = 0; f < 6; f++) {
    const a = f * 1.05 + random() * 0.3;
    const flower = mesh(
      new THREE.ConeGeometry(0.02, 0.03, 5, 1, true),
      bloom,
      root,
      [
        Math.cos(a) * width * 0.4 + lean * height,
        height * 0.98,
        Math.sin(a) * width * 0.4,
      ],
    );
    flower.rotation.x = Math.PI;
  }
  return root;
}
