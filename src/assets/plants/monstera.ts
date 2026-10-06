import * as THREE from "three";
import { material, curvedStem, mesh } from "../geometry";
import { monsteraLeaves } from "../../model/plantSurfaces";
import type { AssetDefinition } from "../types";

export const monstera: AssetDefinition = {
  kind: "monstera",
  name: "Monstera",
  scientificName: "Monstera deliciosa",
  category: "Plants",
  description: "Big split leaves for a lush tropical canopy.",
  radius: 0.48,
  habitat: "land",
  shelter: true,
  soil: "damp",
  perches: monsteraLeaves,
  build,
};

const UP = new THREE.Vector3(0, 1, 0);
function build(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#507139");
  const greens = ["#245c36", "#337a43", "#2f6e3e", "#265f38"];
  const leaves = monsteraLeaves(random);
  // How far along the plant is: young plants have fewer, shallower splits.
  const maturity = 0.45 + random() * 0.55;
  for (const [i, surface] of leaves.entries()) {
    curvedStem(
      root,
      surface.stem.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
      0.022,
      stem,
    );
    // Higher leaves are older and more deeply split.
    const age = maturity * (0.55 + 0.45 * Math.min(1, surface.tip.y / 1.4));
    const leaf = mesh(
      monsteraBlade(surface.length, surface.width * 1.05, age),
      material(greens[i % 4], 0.6),
      root,
      new THREE.Vector3(surface.tip.x, surface.tip.y, surface.tip.z),
    );
    leaf.quaternion.setFromUnitVectors(
      UP,
      new THREE.Vector3(
        surface.direction.x,
        surface.direction.y,
        surface.direction.z,
      ),
    );
    // A raised midrib catches the light and makes the simplified foliage read as a plant.
    curvedStem(
      leaf,
      [
        new THREE.Vector3(0, 0, 0.005),
        new THREE.Vector3(0, 0.35, 0.13),
        new THREE.Vector3(0, 0.72, 0.02),
      ],
      0.006,
      stem,
    );
  }
  return root;
}

/** A heart-shaped blade along +Y, cupped like the other leaves so its midrib
 * matches the perch the frogs use. Each half is a grid running from the
 * midrib (s = 0) to the edge (s = 1); leaving out narrow bands of cells cuts
 * slits that stop short of the midrib, and older leaves lose a few cells
 * beside the midrib as enclosed holes. */
function monsteraBlade(length: number, width: number, age: number) {
  const along = 28,
    across = 6;
  const start = -0.16;
  const t = (i: number) => start + (i / along) * (1 - start);
  const s = (j: number) => j / across;
  // Broadest a third of the way out, narrowing to the tip, with lobes
  // either side of the notch at the base.
  const halfWidth = (at: number) =>
    (width / 2) * Math.max(0, 1 - ((at - 0.33) / 0.67) ** 2) ** 0.55;
  // Veins sweep back at the base and forward toward the tip.
  const sweep = (at: number) => 0.2 * (at - 0.22);
  const point = (i: number, j: number, side: number) => {
    const u = t(i),
      v = s(j);
    const x = side * v * halfWidth(u),
      y = (u + sweep(u) * v) * length;
    return new THREE.Vector3(
      x,
      y,
      0.16 * Math.sin((y / length) * Math.PI) * length - Math.abs(x) * 0.18,
    );
  };
  const splits = Math.round(age * 7);
  // Slits run between the lobes, evenly from the base lobe to near the tip.
  const slitAt = new Set(
    Array.from({ length: splits }, (_, k) =>
      Math.round(along * (0.22 + (k / Math.max(1, splits - 1)) * 0.62)),
    ),
  );
  // Holes sit beside the midrib just past each slit, touching it only at a
  // corner so the leaf stays in one piece.
  const holeAt = new Set(
    age > 0.6 ? [...slitAt].slice(0, -1).map((i) => i + 1) : [],
  );
  const corners: THREE.Vector3[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i < along; i++)
      for (let j = 0; j < across; j++) {
        // The notch where the stalk meets the blade.
        if (t(i + 1) <= 0.02 && j < 2) continue;
        if (slitAt.has(i) && j >= 2) continue;
        if (holeAt.has(i) && j === 1) continue;
        const a = point(i, j, side),
          b = point(i + 1, j, side),
          c = point(i + 1, j + 1, side),
          d = point(i, j + 1, side);
        corners.push(a, b, c, a, c, d);
      }
  const geometry = new THREE.BufferGeometry().setFromPoints(corners);
  geometry.computeVertexNormals();
  return geometry;
}
