import * as THREE from "three";
import { mesh } from "../geometry";
import type { AssetDefinition } from "../types";
import { stoneMaterial, weatheredStone } from "./rock";

export const standingStone: AssetDefinition = {
  kind: "standing-stone",
  name: "Standing stone",
  group: "Stone",
  biomes: ["Tropical", "Temperate", "Desert"],
  description:
    "A narrow, upright stone. Two or three can hold up a capstone over a hiding place.",
  radius: 0.26,
  scaleRange: [0.85, 1.15],
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: (random) => weathered(random, [0.4, 0.62, 0.66], 0.12),
};

export const capstone: AssetDefinition = {
  kind: "capstone",
  name: "Capstone",
  group: "Stone",
  biomes: ["Tropical", "Temperate", "Desert"],
  description:
    "A broad, flattened stone to lay across standing stones, or flat on the ground to bask on.",
  radius: 0.5,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  shelter: true,
  build: (random) => weathered(random, [1.08, 0.34, 0.86], 0.07),
};

/** A weathered stone stretched to `size`, raised so its underside sits
 * just into the ground. */
function weathered(
  random: () => number,
  size: [number, number, number],
  y: number,
) {
  const root = new THREE.Group();
  const part = mesh(
    weatheredStone(random() * 10),
    stoneMaterial(random),
    root,
    new THREE.Vector3(0, y, 0),
  );
  part.scale.fromArray(size);
  return root;
}
