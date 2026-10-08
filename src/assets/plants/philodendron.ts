import * as THREE from "three";
import { curvedStem, material } from "../geometry";
import { heart, orient } from "../heart";
import { barkLimb } from "../landscape/bark";
import {
  philodendronPerches,
  philodendronVine,
} from "../../model/plantSurfaces";
import type { AssetDefinition } from "../types";

export const philodendron: AssetDefinition = {
  kind: "philodendron",
  name: "Climbing philodendron",
  scientificName: "Philodendron hederaceum",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description:
    "A heartleaf vine climbing a moss pole. Frogs climb it to the big upper leaves.",
  radius: 0.3,
  size: 1.3,
  scaleRange: [0.7, 1.4],
  habitat: "land",
  shelter: true,
  soil: "damp",
  perches: philodendronPerches,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const { height, poleRadius, vine, leaves } = philodendronVine(random);
  // A moss pole, mottled green and brown, ending below the vine's top leaves
  // so the plant reads as foliage rather than a post.
  const moss = material("#4f5b30", 0.97);
  moss.vertexColors = true;
  barkLimb(
    root,
    [
      [0, -0.05, 0],
      [0.01, height * 0.45, -0.01],
      [-0.005, height * 0.85, 0.005],
    ],
    [poleRadius * 1.1, poleRadius, poleRadius * 0.92],
    { bark: moss, cut: material("#5e5236", 0.95) },
  );
  const stem = material("#4d7438");
  curvedStem(
    root,
    vine.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    0.007,
    stem,
  );
  const greens = ["#2c6537", "#367640", "#285b33"].map((color) =>
    material(color, 0.45),
  );
  for (const [i, leaf] of leaves.entries()) {
    const at = vine[leaf.node];
    curvedStem(
      root,
      [
        new THREE.Vector3(at.x, at.y, at.z),
        new THREE.Vector3(leaf.base.x, leaf.base.y, leaf.base.z),
      ],
      0.005,
      stem,
    );
    const blade = heart(leaf.length, leaf.width, leaf.droop, greens[i % 3]);
    orient(blade, leaf.base, leaf.direction, leaf.normal);
    root.add(blade);
  }
  return root;
}
