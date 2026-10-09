import * as THREE from "three";
import { branch, material, mesh } from "../geometry";
import { ringVolume, triangles, type Point } from "../faceted";
import type { AssetDefinition } from "../types";

export const spruce: AssetDefinition = {
  kind: "spruce",
  name: "Blue spruce seedling",
  scientificName: "Picea pungens",
  group: "Leafy plants",
  biomes: ["Temperate"],
  description:
    "A young spruce, stiff and silvery blue-green, growing in tiers along a mountain stream.",
  radius: 0.3,
  habitat: "land",
  shelter: true,
  soil: "drained",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const height = 0.65 + random() * 0.25;
  // Young spruce rarely grow dead straight.
  const lean = new THREE.Vector2(random() - 0.5, random() - 0.5).multiplyScalar(
    0.06,
  );
  const axis = (y: number) => new THREE.Vector3(lean.x * y, y, lean.y * y);
  const bark = material("#4e3a2b", 0.9);
  branch(root, axis(0), axis(height * 0.9), 0.022, bark, 0.006);
  const needles = [
    material("#4c6f66"),
    material("#5a7f74"),
    material("#41615a"),
    material("#6a8c80"),
  ];
  // Whorls of drooping sprays, longest low down and shortening toward the
  // tip, each turned and trimmed a little differently so the outline is ragged.
  const whorls = 13 + Math.floor(random() * 3);
  for (let w = 0; w < whorls; w++) {
    const t = w / (whorls - 1);
    const y = height * (0.17 + 0.75 * t + (random() - 0.5) * 0.02);
    const reach = height * (0.3 * (1 - t) ** 0.9 + 0.06);
    const sprays = t > 0.8 ? 5 : 7 + Math.floor(random() * 2);
    const turn = random() * Math.PI * 2;
    for (let s = 0; s < sprays; s++) {
      const angle =
        turn + ((s + (random() - 0.5) * 0.5) * Math.PI * 2) / sprays;
      const length = reach * (0.75 + random() * 0.4);
      mesh(
        spray(axis(y), angle, length, 0.2 + 0.15 * (1 - t)),
        needles[Math.floor(random() * needles.length)],
        root,
      );
    }
  }
  // The leader, a slim spike above the last whorl.
  const top = axis(height * 0.9);
  mesh(
    ringVolume([
      ring(top.x, top.y, top.z, 0.03),
      ring(top.x, top.y + height * 0.05, top.z, 0.014),
      ring(lean.x * height, height, lean.y * height, 0.001),
    ]),
    needles[0],
    root,
  );
  return root;
}

function ring(x: number, y: number, z: number, radius: number) {
  return Array.from({ length: 5 }, (_, side): Point => {
    const a = (side * Math.PI * 2) / 5;
    return [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
  });
}

/** One drooping spray of needles: a shallow ridged blade from the trunk out
 * to a tip that hangs below where it starts. */
function spray(
  start: THREE.Vector3,
  angle: number,
  length: number,
  droop: number,
) {
  const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new THREE.Vector3(-out.z, 0, out.x);
  const at = (along: number, across: number, lift: number): Point => {
    const p = start
      .clone()
      .addScaledVector(out, along * length)
      .addScaledVector(side, across * length)
      .add(
        new THREE.Vector3(0, lift * length - droop * length * along ** 2, 0),
      );
    return [p.x, p.y, p.z];
  };
  const points = [
    at(0, 0, 0.06),
    at(0.5, 0.38, -0.03),
    at(0.5, 0, 0.12),
    at(0.5, -0.38, -0.03),
    at(1, 0, 0),
    at(0.45, 0, -0.05),
  ];
  return triangles(
    points,
    [0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3, 0, 5, 1, 0, 3, 5, 1, 5, 4, 5, 3, 4],
  );
}
