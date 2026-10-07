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
 * matches the perch the frogs use. Each half is a solid band along the
 * midrib, then a row of lobes out to the edge. The slits between lobes open
 * from nothing at the band to a wedge at the edge, and each lobe rounds off
 * at its tip. Older leaves have more lobes, cut deeper. */
function monsteraBlade(length: number, width: number, age: number) {
  const start = -0.16;
  const lobes = 2 + Math.round(age * 2.5);
  // How far out from the midrib the slits begin.
  const band = 0.75 - age * 0.45;
  // Broad and heart-shaped, with lobes either side of the notch at the base.
  const halfWidth = (at: number) =>
    (width / 2) * Math.max(0, 1 - ((at - 0.3) / 0.7) ** 2) ** 0.45;
  const point = (u: number, v: number, side: number) => {
    const x = side * v * halfWidth(u);
    // Veins sweep back at the base and curve toward the tip at the edge.
    const y = (u + 0.2 * (u - 0.22) * v + 0.1 * v * v) * length;
    return new THREE.Vector3(
      x,
      y,
      0.16 * Math.sin((y / length) * Math.PI) * length - Math.abs(x) * 0.18,
    );
  };
  const corners: THREE.Vector3[] = [];
  const quad = (
    side: number,
    [u0, u1]: number[],
    [u2, u3]: number[],
    v0: number,
    v1: number,
  ) => {
    const a = point(u0, v0, side),
      b = point(u1, v0, side),
      c = point(u3, v1, side),
      d = point(u2, v1, side);
    corners.push(a, b, c, a, c, d);
  };
  const along = (i: number, steps: number) => start + (i / steps) * (1 - start);
  for (const side of [-1, 1]) {
    // The band along the midrib, leaving the notch where the stalk joins.
    const steps = lobes * 3;
    for (let i = 0; i < steps; i++) {
      const u0 = along(i, steps),
        u1 = along(i + 1, steps);
      quad(side, [u0, u1], [u0, u1], u1 <= 0.02 ? 0.25 : 0, band);
    }
    for (let k = 0; k < lobes; k++) {
      const from = along(k, lobes),
        to = along(k + 1, lobes);
      const middle = (from + to) / 2;
      // The lobe's span at a fraction f of the way from the band to the edge.
      const span = (f: number) => {
        const half = ((to - from) / 2) * (1 - 0.06 * f - 0.3 * f ** 3);
        return Array.from(
          { length: 4 },
          (_, i) => middle - half + (i / 3) * half * 2,
        );
      };
      for (const [f0, f1] of [
        [0, 0.5],
        [0.5, 1],
      ]) {
        const inner = span(f0),
          outer = span(f1);
        for (let i = 0; i < 3; i++)
          quad(
            side,
            [inner[i], inner[i + 1]],
            [outer[i], outer[i + 1]],
            band + (1 - band) * f0,
            band + (1 - band) * f1,
          );
      }
    }
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(corners);
  geometry.computeVertexNormals();
  return geometry;
}
