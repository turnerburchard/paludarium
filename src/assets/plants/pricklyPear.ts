import * as THREE from "three";
import { material, mesh } from "../geometry";
import type { AssetDefinition } from "../types";

export const pricklyPear: AssetDefinition = {
  kind: "prickly-pear",
  name: "Prickly pear",
  scientificName: "Opuntia engelmannii",
  group: "Cacti & succulents",
  biomes: ["Desert"],
  description:
    "Flat, spiny pads stacked on one another, edged with yellow flowers and purple fruit.",
  radius: 0.34,
  habitat: "land",
  shelter: true,
  blocksMovement: true,
  soil: "arid",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const pads = [material("#6f9150", 0.75), material("#7e9e5a", 0.75)];
  const spine = material("#e8dfc0"),
    fruit = material("#8a2c55", 0.5),
    bloom = material("#ecc943", 0.6);
  // Each pad grows from the rim of the one below it, fanning out and up.
  const grow = (
    base: THREE.Vector3,
    angle: number,
    tilt: number,
    size: number,
    depth: number,
  ) => {
    const pad = new THREE.Group();
    pad.position.copy(base);
    pad.rotation.set(0, angle, tilt);
    root.add(pad);
    const body = mesh(
      new THREE.IcosahedronGeometry(1, 1),
      pads[depth % pads.length],
      pad,
      [0, size, 0],
    );
    body.scale.set(size * 0.75, size, size * 0.16);
    for (let s = 0; s < 6; s++) {
      const a = s * 2.4 + random();
      const r = 0.65 * random() ** 0.5;
      for (const face of [-1, 1])
        mesh(new THREE.TetrahedronGeometry(0.008), spine, pad, [
          Math.cos(a) * r * size * 0.7,
          size + Math.sin(a) * r * size,
          face * size * 0.16,
        ]);
    }
    const tip = new THREE.Vector3(0, size * 2, 0)
      .applyEuler(pad.rotation)
      .add(base);
    if (depth < 2) {
      for (let c = 0; c < 2; c++)
        if (random() < 0.75)
          grow(
            tip.clone().setY(tip.y - size * 0.15),
            angle + (random() - 0.5) * 1.6,
            (c ? 1 : -1) * (0.45 + random() * 0.4),
            size * 0.82,
            depth + 1,
          );
      return;
    }
    // The outermost pads carry flowers and fruit along their rims.
    for (let f = 0; f < 2; f++) {
      if (random() > 0.6) continue;
      const along = (f - 0.5) * 0.9;
      mesh(
        new THREE.IcosahedronGeometry(0.028, 0),
        random() < 0.5 ? fruit : bloom,
        pad,
        [Math.sin(along) * size * 0.75, size + Math.cos(along) * size, 0],
      );
    }
  };
  for (let i = 0; i < 2; i++)
    grow(
      new THREE.Vector3((i - 0.5) * 0.1, 0, 0),
      i * 1.4 + random(),
      (i - 0.5) * 0.4,
      0.12 + random() * 0.03,
      0,
    );
  return root;
}
