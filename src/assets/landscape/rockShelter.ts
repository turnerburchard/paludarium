import * as THREE from "three";
import { mesh } from "../geometry";
import type { AssetDefinition } from "../types";
import { stoneMaterial, weatheredStone } from "./rock";

export const rockShelter: AssetDefinition = {
  kind: "rock-shelter",
  name: "Rock shelter",
  category: "Landscape",
  description:
    "A flat stone resting on two boulders. Frogs hide in the gap beneath.",
  radius: 0.66,
  habitat: "either",
  blocksMovement: true,
  shelter: true,
  dens: () => [
    { entrance: { x: 0, y: 0, z: 0.5 }, inside: { x: 0, y: 0, z: 0.02 } },
  ],
  build,
};

/** Stones by centre, scale, turn about Y and tilt about X. The gap under the
 * capstone, which settles slightly toward the back, fits a frog. */
const STONES = [
  { at: [-0.44, 0.1, 0], size: [0.4, 0.62, 0.66], turn: 0.3, tilt: 0 },
  { at: [0.45, 0.08, 0.02], size: [0.38, 0.56, 0.6], turn: -0.4, tilt: 0 },
  { at: [0.0, 0.08, -0.34], size: [0.5, 0.5, 0.36], turn: 1.4, tilt: 0 },
  {
    at: [0.02, 0.36, -0.03],
    size: [1.08, 0.34, 0.86],
    turn: 0.15,
    tilt: -0.06,
  },
] as const;

function build(random: () => number) {
  const root = new THREE.Group();
  for (const [i, stone] of STONES.entries()) {
    const part = mesh(
      weatheredStone(i * 1.7 + random()),
      stoneMaterial(random),
      root,
      new THREE.Vector3().fromArray(stone.at),
    );
    part.scale.fromArray(stone.size);
    part.rotation.set(stone.tilt, stone.turn, 0, "YXZ");
  }
  return root;
}
