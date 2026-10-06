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
/** Half a heart from the pointed tip back around the basal lobe to the
 * notch, as fractions of the blade's length and width. */
const OUTLINE: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.9, 0.12],
  [0.76, 0.26],
  [0.58, 0.38],
  [0.38, 0.45],
  [0.18, 0.46],
  [0.02, 0.41],
  [-0.14, 0.3],
  [-0.2, 0.16],
  [-0.12, 0.05],
  [0.03, 0],
];

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
 * matches the perch the frogs use. Facets fan out from a point on the
 * midrib, and slits are wedges cut in from the edge, more on older leaves. */
function monsteraBlade(length: number, width: number, age: number) {
  const loop = [
    ...OUTLINE,
    ...OUTLINE.slice(1, -1)
      .reverse()
      .map(([u, v]) => [u, -v] as const),
  ];
  const outline = resample(loop, 56);
  const center = [0.36, 0] as const;
  // Slits stop short of the midrib, at the first ring.
  const rings = [0.35, 0.7, 1];
  const splits = Math.round(age * 5);
  const slitAt = Array.from({ length: splits }, (_, k) => 0.24 + k * 0.12);
  // Sectors are the wedges between neighbouring outline points.
  const middle = (i: number) => {
    const [u0, v0] = outline[i],
      [u1, v1] = outline[(i + 1) % outline.length];
    return [(u0 + u1) / 2, (v0 + v1) / 2] as const;
  };
  const nearest = (u: number, side: number) =>
    outline
      .map((_, i) => i)
      .filter((i) => Math.sign(middle(i)[1]) === side)
      .reduce((best, i) =>
        Math.abs(middle(i)[0] - u) < Math.abs(middle(best)[0] - u) ? i : best,
      );
  const slits = new Set(
    [-1, 1].flatMap((side) => slitAt.map((u) => nearest(u, side))),
  );

  const lift = (u: number, v: number): THREE.Vector3 => {
    const x = v * width,
      y = u * length;
    return new THREE.Vector3(
      x,
      y,
      0.16 * Math.sin((y / length) * Math.PI) * length - Math.abs(x) * 0.18,
    );
  };
  const ring = (i: number, scale: number) => {
    const [u, v] = outline[i % outline.length];
    return lift(
      center[0] + (u - center[0]) * scale,
      center[1] + (v - center[1]) * scale,
    );
  };
  const corners: THREE.Vector3[] = [];
  const middleOfLeaf = lift(...center);
  for (let i = 0; i < outline.length; i++) {
    corners.push(middleOfLeaf, ring(i + 1, rings[0]), ring(i, rings[0]));
    for (let r = 0; r < rings.length - 1; r++) {
      if (slits.has(i)) continue;
      const [a, b] = [rings[r], rings[r + 1]];
      corners.push(ring(i, a), ring(i + 1, a), ring(i + 1, b));
      corners.push(ring(i, a), ring(i + 1, b), ring(i, b));
    }
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(corners);
  geometry.computeVertexNormals();
  return geometry;
}

/** Evenly spaced points around a closed outline. */
function resample(
  loop: readonly (readonly [number, number])[],
  count: number,
): (readonly [number, number])[] {
  const lengths = loop.map((p, i) => {
    const q = loop[(i + 1) % loop.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  const total = lengths.reduce((sum, l) => sum + l, 0);
  const points: (readonly [number, number])[] = [];
  let segment = 0,
    start = 0;
  for (let k = 0; k < count; k++) {
    const at = (k / count) * total;
    while (start + lengths[segment] < at) start += lengths[segment++];
    const t = (at - start) / lengths[segment];
    const p = loop[segment],
      q = loop[(segment + 1) % loop.length];
    points.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  return points;
}
