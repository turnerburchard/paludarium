import * as THREE from "three";
import { material, curvedStem, blade } from "../geometry";
import { monsteraLeaves } from "../../model/plantSurfaces";
import type { AssetDefinition } from "../types";

export const swissCheesePlant: AssetDefinition = {
  kind: "swiss-cheese-plant",
  name: "Swiss cheese plant",
  scientificName: "Monstera adansonii",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description: "Pointed leaves full of oval holes, on long arching stalks.",
  radius: 0.48,
  size: 0.6,
  habitat: "land",
  shelter: true,
  soil: "damp",
  perches: monsteraLeaves,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#507139");
  const greens = ["#2c6a3a", "#3b8346", "#4a9450", "#2e6a3c"];
  for (const [i, surface] of monsteraLeaves(random).entries()) {
    curvedStem(
      root,
      surface.stem.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
      0.018,
      stem,
    );
    const leaf = blade(
      root,
      new THREE.Vector3(surface.tip.x, surface.tip.y, surface.tip.z),
      new THREE.Vector3(
        surface.direction.x,
        surface.direction.y,
        surface.direction.z,
      ),
      surface.length,
      surface.width,
      material(greens[i % 4]),
      false,
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
