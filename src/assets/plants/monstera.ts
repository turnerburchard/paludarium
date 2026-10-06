import * as THREE from "three";
import { material, curvedStem, blade } from "../geometry";
import { monsteraLeaves } from "../../model/plantSurfaces";
import type { AssetDefinition } from "../types";

export const monstera: AssetDefinition = {
  kind: "monstera",
  name: "Monstera",
  scientificName: "Monstera deliciosa",
  category: "Plants",
  description: "Big split leaves for a lush tropical canopy.",
  radius: 0.48,
  habitat: "land",
  shelter: true,
  soil: "damp",
  perches: monsteraLeaves,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#507139");
  const greens = ["#245c36", "#337a43", "#458d4d", "#265f38"];
  for (const [i, surface] of monsteraLeaves(random).entries()) {
    const tip = new THREE.Vector3(surface.tip.x, surface.tip.y, surface.tip.z);
    curvedStem(
      root,
      surface.stem.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
      0.022,
      stem,
    );
    const direction = new THREE.Vector3(
      surface.direction.x,
      surface.direction.y,
      surface.direction.z,
    );
    const leaf = blade(
      root,
      tip,
      direction,
      surface.length,
      surface.width,
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
