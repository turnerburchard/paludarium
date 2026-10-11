import * as THREE from "three";
import { branch, material } from "../geometry";
import { barkLimb } from "../landscape/bark";
import type { AssetDefinition } from "../types";
import { frond } from "./fern";

export const treeFern: AssetDefinition = {
  kind: "tree-fern",
  name: "Tree fern",
  scientificName: "Cyathea sp.",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description:
    "A fern grown into a small tree: a shaggy trunk of old frond bases topped by a crown of long, arching fronds. Tree ferns crowd the misty slopes of Central America's cloud forests.",
  radius: 0.75,
  scaleRange: [0.8, 1.2],
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  // A slightly leaning trunk, thickest at the base where roots matt it.
  const lean = random() * Math.PI * 2;
  const top = new THREE.Vector3(
    Math.cos(lean) * 0.08,
    0.95 + random() * 0.15,
    Math.sin(lean) * 0.08,
  );
  const trunk = [0, 0.3, 0.65, 1].map(
    (t) => new THREE.Vector3(top.x * t * t, top.y * t, top.z * t * t),
  );
  const fibers = material("#4a3829", 0.95);
  fibers.vertexColors = true;
  barkLimb(
    root,
    trunk.map((p) => [p.x, p.y, p.z]),
    [0.085, 0.07, 0.062, 0.058],
    { bark: fibers, cut: material("#3a2c20", 0.95) },
  );
  // Old frond bases stay on the trunk as a shaggy coat.
  const stubs = material("#5c4430", 0.95);
  for (let i = 0; i < 14; i++) {
    const t = 0.25 + (i / 14) * 0.7;
    const at = trunk[0].clone().lerp(top, t);
    const angle = i * 2.4 + random();
    const out = new THREE.Vector3(Math.cos(angle), -0.4, Math.sin(angle));
    branch(
      root,
      at,
      at.clone().addScaledVector(out, 0.09),
      0.016,
      stubs,
      0.004,
    );
  }
  // The crown: long fronds rise from the top, arch out and droop.
  const stem = material("#4f6a2c"),
    greens = [material("#3f7a36"), material("#4d8a3c"), material("#36703a")];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + random() * 0.3;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const reach = 0.65 + random() * 0.2;
    const rise = 0.18 + random() * 0.12;
    const points = [0, 0.3, 0.6, 1].map((t) =>
      top
        .clone()
        .addScaledVector(out, reach * t)
        .add(
          new THREE.Vector3(
            0,
            rise * Math.sin(t * Math.PI * 0.8) - 0.35 * t * t,
            0,
          ),
        ),
    );
    frond(root, points, stem, greens[i % 3], 1.5);
  }
  return root;
}
