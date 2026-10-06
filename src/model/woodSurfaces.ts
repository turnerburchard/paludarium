import type { Den, PlantPerch, PlantPoint } from "./plantSurfaces";

/** A tapered length of wood through center points, with a radius at each. */
export interface Limb {
  points: PlantPoint[];
  radii: number[];
}

/** A branch leaning out of the substrate, gentle enough for any frog to walk
 * up, with a side limb near the top. */
export function branchLimbs(random: () => number): Limb[] {
  const jitter = () => (random() - 0.5) * 0.08;
  const main: Limb = {
    points: [
      { x: -0.52, y: -0.04, z: 0 },
      { x: -0.2, y: 0.24 + jitter(), z: 0.04 + jitter() },
      { x: 0.14, y: 0.5 + jitter(), z: jitter() },
      { x: 0.44, y: 0.74 + jitter(), z: 0.03 },
    ],
    radii: [0.095, 0.078, 0.06, 0.036],
  };
  const fork = main.points[2];
  const side: Limb = {
    points: [
      { x: fork.x - 0.04, y: fork.y - 0.03, z: fork.z },
      { x: fork.x + 0.16, y: fork.y + 0.1, z: fork.z + 0.18 },
      { x: fork.x + 0.34, y: fork.y + 0.14 + jitter(), z: fork.z + 0.34 },
    ],
    radii: [0.045, 0.03, 0.012],
  };
  const twig: Limb = {
    points: [
      { x: -0.22, y: main.points[1].y + 0.01, z: main.points[1].z },
      { x: -0.3, y: main.points[1].y + 0.2, z: main.points[1].z - 0.16 },
    ],
    radii: [0.024, 0.007],
  };
  return [main, side, twig];
}

export function branchPerches(random: () => number): PlantPerch[] {
  const [main, side] = branchLimbs(random);
  const up = alongTop(main, [0.06, 0.25, 0.45, 0.62]);
  const top = alongTop(main, [0.8, 0.9]);
  const out = alongTop(side, [0.3, 0.6]);
  return [
    {
      stem: [...up.points, top.points[0]],
      barkNormals: [...up.normals, top.normals[0]],
      perch: top.points[1],
      perchNormal: top.normals[1],
    },
    {
      stem: up.points,
      barkNormals: up.normals,
      perch: out.points[1],
      perchNormal: out.normals[1],
    },
  ];
}

/** A hollow log lying half sunk in the substrate along X. */
export function logShape(random: () => number) {
  const wobble = () => (random() - 0.5) * 0.03;
  const outer: Limb = {
    points: [-0.56, -0.28, 0, 0.28, 0.56].map((x) => ({
      x,
      y: 0.12 + wobble(),
      z: wobble(),
    })),
    radii: [0.185, 0.2, 0.205, 0.195, 0.18],
  };
  return { outer, inner: outer.radii.map((r) => r * 0.72) };
}

export function logPerches(random: () => number): PlantPerch[] {
  const { outer } = logShape(random);
  const top = alongTop(outer, [0.08, 0.35, 0.6, 0.7]);
  return [
    {
      stem: [{ x: -0.74, y: 0, z: 0 }, ...top.points.slice(0, 3)],
      barkNormals: [{ x: 0, y: 1, z: 0 }, ...top.normals.slice(0, 3)],
      perch: top.points[3],
      perchNormal: top.normals[3],
    },
  ];
}

export function logDens(): Den[] {
  return [
    { entrance: { x: 0.72, y: 0, z: 0 }, inside: { x: 0.05, y: 0, z: 0 } },
  ];
}

/** Points just above the top of a limb's bark, at fractions along its
 * length, with the bark's upward-facing normal there. */
export function alongTop(limb: Limb, fractions: readonly number[]) {
  const last = limb.points.length - 1;
  const points: PlantPoint[] = [];
  const normals: PlantPoint[] = [];
  for (const fraction of fractions) {
    const at = Math.min(fraction * last, last - 1e-6);
    const i = Math.floor(at),
      t = at - i;
    const a = limb.points[i],
      b = limb.points[i + 1];
    const axisLength = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const axis = {
      x: (b.x - a.x) / axisLength,
      y: (b.y - a.y) / axisLength,
      z: (b.z - a.z) / axisLength,
    };
    // World up, made square to the limb: the top of its bark.
    const normalLength = Math.hypot(
      -axis.x * axis.y,
      1 - axis.y * axis.y,
      -axis.z * axis.y,
    );
    const normal = {
      x: (-axis.x * axis.y) / normalLength,
      y: (1 - axis.y * axis.y) / normalLength,
      z: (-axis.z * axis.y) / normalLength,
    };
    const radius = limb.radii[i] + (limb.radii[i + 1] - limb.radii[i]) * t;
    const lift = radius + 0.008;
    points.push({
      x: a.x + (b.x - a.x) * t + normal.x * lift,
      y: a.y + (b.y - a.y) * t + normal.y * lift,
      z: a.z + (b.z - a.z) * t + normal.z * lift,
    });
    normals.push(normal);
  }
  return { points, normals };
}
