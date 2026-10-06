import * as THREE from "three";
import { branchLimbs, branchPerches } from "../../model/woodSurfaces";
import type { Point } from "../faceted";
import type { AssetDefinition } from "../types";
import { barkLimb, barkMaterials } from "./bark";

export const branch: AssetDefinition = {
  kind: "branch",
  name: "Leaning branch",
  category: "Landscape",
  description:
    "A branch rising from the ground. Frogs walk up it to a lookout.",
  radius: 0.55,
  habitat: "either",
  mossGrows: true,
  perches: branchPerches,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const wood = barkMaterials();
  for (const limb of branchLimbs(random))
    barkLimb(
      root,
      limb.points.map((p): Point => [p.x, p.y, p.z]),
      limb.radii,
      wood,
    );
  return root;
}
