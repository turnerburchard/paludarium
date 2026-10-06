import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import { nestFernFronds } from "../../model/plantSurfaces";
import type { AssetDefinition } from "../types";

export const nestFern: AssetDefinition = {
  kind: "nest-fern",
  name: "Bird's nest fern",
  scientificName: "Asplenium nidus",
  category: "Plants",
  description:
    "Glossy, wavy fronds rising from a central nest. Frogs climb out along them.",
  radius: 0.45,
  habitat: "land",
  shelter: true,
  soil: "damp",
  perches: nestFernFronds,
  build,
};

const vec = (p: { x: number; y: number; z: number }) =>
  new THREE.Vector3(p.x, p.y, p.z);

function build(random: () => number) {
  const root = new THREE.Group();
  const fronds = nestFernFronds(random);
  const skin = material("#ffffff", 0.45);
  skin.vertexColors = true;
  const greens = ["#7fbf3f", "#6aaf38", "#8ac84a"].map(
    (c) => new THREE.Color(c),
  );
  const rib = new THREE.Color("#3b4a22");
  for (const [i, frond] of fronds.entries()) {
    const green = greens[i % 3];
    const leaf = mesh(
      ovalLeaf({
        length: frond.length,
        width: frond.width,
        droop: frond.droop,
        cup: 0.25,
        wave: 0.025,
        // A dark midrib down a bright, glossy frond.
        color: (_, out) => (out < 0.34 ? rib : green),
      }),
      skin,
      root,
    );
    placeLeaf(leaf, vec(frond.base), vec(frond.direction), vec(frond.normal));
  }
  // The brown, fibrous nest the fronds rise from.
  const nest = mesh(
    new THREE.IcosahedronGeometry(0.09, 0),
    material("#5a4430", 0.95),
    root,
    [0, 0.03, 0],
  );
  nest.scale.set(1, 0.55, 1);
  nest.rotation.y = random() * Math.PI;
  return root;
}
