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
      monsteraBlade(surface.length, surface.width * 1.25, age),
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
  const along = 44,
    across = 8;
  const start = -0.16;
  const t = (i: number) => start + (i / along) * (1 - start);
  const s = (j: number) => j / across;
  const splits = Math.round(age * 5);
  // Slits run between the lobes, evenly from the base lobe to near the tip.
  const slitAt = Array.from({ length: splits }, (_, k) =>
    Math.round(along * (0.2 + (k / Math.max(1, splits - 1)) * 0.64)),
  );
  // Broad and heart-shaped, with lobes either side of the notch at the base.
  const halfWidth = (at: number) =>
    (width / 2) * Math.max(0, 1 - ((at - 0.3) / 0.7) ** 2) ** 0.45;
  // Lobes narrow toward the slits either side, so their ends are rounded.
  const lobe = (i: number) => {
    if (!slitAt.length) return 1;
    const gap = Math.min(...slitAt.map((slit) => Math.abs(i + 0.5 - slit)));
    return 1 - 0.2 * Math.exp(-(gap * gap) / 2);
  };
  const point = (i: number, j: number, side: number) => {
    const u = t(i),
      v = s(j);
    const x = side * v * halfWidth(u) * (1 - (1 - lobe(i)) * v ** 3);
    // Veins sweep back at the base and curve toward the tip at the edge.
    const y = (u + 0.2 * (u - 0.22) * v + 0.1 * v * v) * length;
    return new THREE.Vector3(
      x,
      y,
      0.16 * Math.sin((y / length) * Math.PI) * length - Math.abs(x) * 0.18,
    );
  };
  // Each slit stops short of the midrib and opens a little at the edge.
  const cut = (i: number, j: number) =>
    slitAt.some(
      (slit) =>
        (i === slit && j >= 3) ||
        (Math.abs(i - slit) === 1 && j === across - 1),
    );
  // Older leaves have a long hole beside the midrib between slits, clear of
  // the slits so the leaf stays in one piece.
  const hole = (i: number, j: number) =>
    age > 0.6 &&
    j === 1 &&
    slitAt.slice(0, -1).some((slit) => i === slit + 2 || i === slit + 3);
  const corners: THREE.Vector3[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i < along; i++)
      for (let j = 0; j < across; j++) {
        // The notch where the stalk meets the blade.
        if (t(i + 1) <= 0.02 && j < 3) continue;
        if (cut(i, j) || hole(i, j)) continue;
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
