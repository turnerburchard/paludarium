import * as THREE from "three";
import type { Point } from "../faceted";
import type { AssetDefinition } from "../types";
import { barkLimb, barkMaterials } from "./bark";

/** Each limb's heading around the knot, reach, highest point and where it
 * ends. Limbs ending at zero droop back into the substrate. */
const limbs = [
  { angle: 0.2, reach: 0.38, peak: 0.6, end: 0.78 },
  { angle: 1.0, reach: 0.52, peak: 0.26, end: 0 },
  { angle: 1.7, reach: 0.3, peak: 0.55, end: 0.86 },
  { angle: 2.5, reach: 0.42, peak: 0.48, end: 0.62 },
  { angle: 3.3, reach: 0.56, peak: 0.3, end: 0 },
  { angle: 4.1, reach: 0.34, peak: 0.62, end: 0.72 },
  { angle: 4.9, reach: 0.44, peak: 0.42, end: 0.5 },
  { angle: 5.6, reach: 0.5, peak: 0.24, end: 0 },
];

export const spiderwood: AssetDefinition = {
  kind: "spiderwood",
  name: "Spider wood",
  group: "Wood",
  biomes: ["Tropical"],
  description:
    "A tangle of thin, twisting roots, a favorite in planted aquariums.",
  radius: 0.58,
  habitat: "either",
  hardscape: "wood",
  blocksMovement: true,
  groundPoints: [
    { x: 0, z: 0 },
    ...limbs
      .filter((limb) => limb.end === 0)
      .map(({ angle, reach }) => ({
        x: Math.cos(angle) * reach,
        z: Math.sin(angle) * reach,
      })),
  ],
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const wood = barkMaterials();
  barkLimb(
    root,
    [
      [-0.1, 0.02, -0.03],
      [0, 0.07, 0.01],
      [0.06, 0.16, 0.03],
    ],
    [0.08, 0.075, 0.05],
    wood,
  );
  for (const { angle, reach, peak, end } of limbs) {
    // Sideways kinks so each limb twists instead of curving cleanly.
    const kink = () => (random() - 0.5) * 0.12;
    const along = (t: number, y: number, side: number): Point => [
      Math.cos(angle) * reach * t - Math.sin(angle) * side,
      y,
      Math.sin(angle) * reach * t + Math.cos(angle) * side,
    ];
    barkLimb(
      root,
      [
        along(0, 0.08, 0),
        along(0.25, peak * 0.7, kink()),
        along(0.5, peak * 0.95, kink()),
        along(0.75, peak + (end - peak) * 0.4, kink()),
        along(1, end - 0.01, 0),
      ],
      [0.042, 0.032, 0.024, 0.015, 0.007],
      wood,
    );
  }
  return root;
}
