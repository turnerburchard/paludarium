import * as THREE from "three";
import { archLimbs, archPerches } from "../../model/woodSurfaces";
import type { Point } from "../faceted";
import type { AssetDefinition } from "../types";
import { barkLimb, barkMaterials } from "./bark";

export const rootArch: AssetDefinition = {
  kind: "root-arch",
  name: "Root arch",
  group: "Wood",
  biomes: ["Tropical", "Temperate"],
  description:
    "A root arching out of the ground and back in. Frogs cross over the top and rest in the shade beneath.",
  radius: 0.66,
  habitat: "either",
  hardscape: "wood",
  shelter: true,
  groundPoints: [
    { x: -0.66, z: 0 },
    { x: 0.66, z: 0 },
  ],
  perches: archPerches,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const wood = barkMaterials();
  for (const limb of archLimbs(random))
    barkLimb(
      root,
      limb.points.map((p): Point => [p.x, p.y, p.z]),
      limb.radii,
      wood,
    );
  return root;
}
