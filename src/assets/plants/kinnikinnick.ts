import * as THREE from "three";
import { curvedStem, material, mesh } from "../geometry";
import { placeLeaf, roundLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const kinnikinnick: AssetDefinition = {
  kind: "kinnikinnick",
  name: "Kinnikinnick",
  scientificName: "Arctostaphylos uva-ursi",
  group: "Leafy plants",
  biomes: ["Temperate"],
  description:
    "A low, trailing mat of small glossy leaves and red berries that covers rocky mountain ground.",
  radius: 0.34,
  habitat: "land",
  shelter: true,
  soil: "drained",
  build,
};

const UP = new THREE.Vector3(0, 1, 0);
const LEAVES = 14;

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.3);
  skin.vertexColors = true;
  const stem = material("#6b3b2a", 0.8),
    berry = material("#b8261d", 0.4);
  const tones = ["#2f5a2c", "#3d6b33", "#4a7a3a"].map(
    (c) => new THREE.Color(c),
  );
  // Trailing stems creep out from the center along the ground.
  for (let s = 0; s < 8; s++) {
    const angle = s * 0.8 + random() * 0.5;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const bend = new THREE.Vector3(-out.z, 0, out.x).multiplyScalar(
      (random() - 0.5) * 0.12,
    );
    const points = [0, 0.33, 0.66, 1].map((t) =>
      out
        .clone()
        .multiplyScalar(t * (0.22 + random() * 0.08))
        .addScaledVector(bend, Math.sin(t * Math.PI))
        .setY(0.02 + Math.sin(t * Math.PI) * 0.03),
    );
    curvedStem(root, points, 0.005, stem);
    const curve = new THREE.CatmullRomCurve3(points);
    for (let l = 0; l < LEAVES; l++) {
      const at = curve.getPointAt(0.1 + (l / LEAVES) * 0.9);
      const a = random() * Math.PI * 2;
      const tone = tones[Math.floor(random() * tones.length)];
      const leaf = mesh(roundLeaf(0.06, tone), skin, root);
      placeLeaf(leaf, at, new THREE.Vector3(Math.cos(a), 0.4, Math.sin(a)), UP);
      if (random() < 0.12)
        mesh(new THREE.IcosahedronGeometry(0.012, 1), berry, root, [
          at.x,
          at.y + 0.012,
          at.z,
        ]);
    }
  }
  return root;
}
