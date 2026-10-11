import * as THREE from "three";
import { FIG_ROOT_ENDS, figLimbs, figPerches } from "../../model/woodSurfaces";
import type { Point } from "../faceted";
import { material, mesh } from "../geometry";
import type { AssetDefinition } from "../types";
import { barkLimb, barkMaterials } from "./bark";

export const stranglerFig: AssetDefinition = {
  kind: "strangler-fig",
  name: "Strangler fig",
  group: "Wood",
  biomes: ["Tropical"],
  description:
    "The hollow trunk of a strangler fig, whose roots wound down around a host tree until it rotted away inside them. Frogs climb the lattice, and moss hangs from its branches.",
  radius: 0.66,
  habitat: "land",
  hardscape: "wood",
  shelter: true,
  groundPoints: FIG_ROOT_ENDS,
  perches: figPerches,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const wood = barkMaterials();
  const limbs = figLimbs(random);
  for (const limb of limbs)
    barkLimb(
      root,
      limb.points.map((p): Point => [p.x, p.y, p.z]),
      limb.radii,
      wood,
    );
  // Wisps of moss hang from each branch.
  const moss = [material("#9aab82", 0.9), material("#7d9468", 0.9)];
  for (const branch of limbs.slice(-4, -1)) {
    const [start, , end] = branch.points;
    for (let i = 0; i < 6; i++) {
      const t = 0.3 + random() * 0.65;
      const from = new THREE.Vector3(
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t - 0.03,
        start.z + (end.z - start.z) * t,
      );
      mesh(
        hangingWisp(from, 0.18 + random() * 0.28, random),
        moss[i % 2],
        root,
      );
    }
  }
  return root;
}

/** A thin, wavering ribbon hanging straight down from `from`. */
function hangingWisp(
  from: THREE.Vector3,
  length: number,
  random: () => number,
) {
  const segments = 6;
  const turn = random() * Math.PI;
  const across = new THREE.Vector3(Math.cos(turn), 0, Math.sin(turn));
  const corners: THREE.Vector3[] = [];
  let at = from.clone();
  for (let s = 0; s < segments; s++) {
    const next = at
      .clone()
      .add(
        new THREE.Vector3(
          (random() - 0.5) * 0.025,
          -length / segments,
          (random() - 0.5) * 0.025,
        ),
      );
    const width = 0.018 * (1 - s / segments);
    const left = at.clone().addScaledVector(across, width),
      right = at.clone().addScaledVector(across, -width);
    corners.push(left, right, next);
    at = next;
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(corners);
  geometry.computeVertexNormals();
  return geometry;
}
