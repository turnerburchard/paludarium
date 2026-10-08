import * as THREE from "three";
import { material, curvedStem, mesh } from "../geometry";
import { triangles, type Point } from "../faceted";
import { fernFronds, fernPerches } from "../../model/plantSurfaces";
import type { AssetDefinition } from "../types";

export const fern: AssetDefinition = {
  kind: "fern",
  name: "Forest fern",
  group: "Leafy plants",
  biomes: ["Tropical", "Temperate"],
  description:
    "Arching green fronds with rows of narrow leaflets. Provides low cover in damp, shaded parts of the habitat.",
  radius: 0.36,
  size: 1.3,
  habitat: "land",
  shelter: true,
  soil: "damp",
  perches: fernPerches,
  build,
};

const UP = new THREE.Vector3(0, 1, 0);

function build(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#536f2d"),
    greens = [material("#4f8a3c"), material("#3b7643"), material("#649a45")];
  for (const [i, frond] of fernFronds(random).entries()) {
    const curve = new THREE.CatmullRomCurve3(
      frond.points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    );
    curvedStem(root, curve.getPoints(8), 0.007, stem);
    // Paired leaflets along the stalk, longest a third of the way out and
    // tapering to the tip, each swept slightly toward it.
    const pairs = 20;
    const corners: Point[] = [];
    for (let j = 0; j < pairs; j++) {
      const t = 0.14 + (j / (pairs - 1)) * 0.84;
      const at = curve.getPointAt(t);
      const along = curve.getTangentAt(t);
      const across = new THREE.Vector3().crossVectors(along, UP).normalize();
      const size = Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * (1 - t);
      const length = 0.05 + size * 0.26;
      for (const side of [-1, 1]) {
        const out = across
          .clone()
          .multiplyScalar(side)
          .addScaledVector(along, 0.35)
          .addScaledVector(UP, -0.12)
          .normalize();
        const tip = at.clone().addScaledVector(out, length);
        const width = along.clone().multiplyScalar(length * 0.2);
        const mid = at.clone().addScaledVector(out, length * 0.45);
        corners.push(
          [at.x, at.y, at.z],
          [mid.x + width.x, mid.y + width.y + 0.004, mid.z + width.z],
          [tip.x, tip.y, tip.z],
          [at.x, at.y, at.z],
          [tip.x, tip.y, tip.z],
          [mid.x - width.x, mid.y - width.y + 0.004, mid.z - width.z],
        );
      }
    }
    mesh(
      triangles(
        corners,
        corners.map((_, k) => k),
      ),
      greens[i % 3],
      root,
    );
  }
  // A few young fronds still coiled at the crown: a short stalk, then a
  // tip that curls over and in on itself.
  const young = material("#7aa84e");
  for (let k = 0; k < 2; k++) {
    const angle = random() * Math.PI * 2;
    const reach = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const top = new THREE.Vector3(0, 0.17, 0).addScaledVector(reach, 0.03);
    const stalk = [0, 0.25, 0.5, 0.75].map((s) =>
      new THREE.Vector3(0, 0.02, 0).lerp(top, s),
    );
    const coil = Array.from({ length: 7 }, (_, s) => {
      const turn = (s / 6) * Math.PI * 1.7;
      const radius = 0.035 * (1 - s / 8);
      return top
        .clone()
        .addScaledVector(reach, Math.sin(turn) * radius)
        .add(new THREE.Vector3(0, (Math.cos(turn) - 1) * radius, 0));
    });
    curvedStem(root, [...stalk, ...coil], 0.008, young);
  }
  return root;
}
