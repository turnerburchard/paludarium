import * as THREE from "three";
import { barkLimb, barkMaterials } from "./bark";
import type { AssetDefinition } from "../types";

export const wood: AssetDefinition = {
  kind: "wood",
  name: "Driftwood",
  category: "Landscape",
  description: "A branching piece of wood for the forest floor.",
  radius: 0.52,
  habitat: "either",
  mossGrows: true,
  blocksMovement: true,
  build,
};

function build() {
  const root = new THREE.Group();
  const wood = barkMaterials();
  barkLimb(
    root,
    [
      [-0.52, 0.115, -0.015],
      [-0.19, 0.15, 0.02],
      [0.12, 0.19, 0.03],
      [0.5, 0.2, 0.1],
    ],
    [0.1, 0.11, 0.085, 0.055],
    wood,
  );
  barkLimb(
    root,
    [
      [-0.15, 0.16, 0.02],
      [0, 0.31, -0.13],
      [0.2, 0.49, -0.26],
    ],
    [0.052, 0.033, 0.013],
    wood,
  );
  barkLimb(
    root,
    [
      [0.17, 0.2, 0.05],
      [0.37, 0.13, 0.23],
      [0.58, 0.085, 0.36],
    ],
    [0.035, 0.024, 0.008],
    wood,
  );
  return root;
}
