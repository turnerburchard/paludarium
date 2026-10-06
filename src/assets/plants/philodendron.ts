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
  category: "Plants",
  description:
    "A heartleaf vine on a cork pole. Frogs climb it to the big upper leaves.",
  radius: 0.3,
  habitat: "land",
  shelter: true,
  soil: "damp",
  perches: philodendronPerches,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const { height, poleRadius, vine, leaves } = philodendronVine(random);
  const cork = material("#7b6a57", 0.97);
  cork.vertexColors = true;
  // Cork bark is paler and greyer than driftwood, with a ragged cut top.
  barkLimb(
    root,
    [
      [0, -0.05, 0],
      [0.01, height * 0.5, -0.01],
      [-0.005, height, 0.005],
    ],
    [poleRadius * 1.15, poleRadius, poleRadius * 0.92],
    { bark: cork, cut: material("#b49a74", 0.95) },
  );
  const stem = material("#5b7f35");
  curvedStem(
    root,
    vine.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    0.007,
    stem,
  );
  const greens = ["#3f8a3a", "#4c9942", "#367a35"].map((color) =>
    material(color, 0.5),
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
