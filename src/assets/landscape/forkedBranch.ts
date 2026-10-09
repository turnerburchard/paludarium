import * as THREE from "three";
import {
  forkedBranchLimbs,
  forkedBranchPerches,
} from "../../model/woodSurfaces";
import type { Point } from "../faceted";
import type { AssetDefinition } from "../types";
import { barkLimb, barkMaterials } from "./bark";

export const forkedBranch: AssetDefinition = {
  kind: "forked-branch",
  name: "Forked branch",
  group: "Wood",
  biomes: ["Tropical", "Temperate"],
  description:
    "An upright branch that splits in two. Climbing frogs keep a lookout on each arm.",
  radius: 0.45,
  habitat: "either",
  hardscape: "wood",
  groundPoints: [{ x: -0.22, z: 0 }],
  perches: forkedBranchPerches,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const wood = barkMaterials();
  for (const limb of forkedBranchLimbs(random))
    barkLimb(
      root,
      limb.points.map((p): Point => [p.x, p.y, p.z]),
      limb.radii,
      wood,
    );
  return root;
}
