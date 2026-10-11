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

/** A root arching out of the substrate and back in, low enough at each end
 * for any frog to walk over. */
export function archLimbs(random: () => number): Limb[] {
  const jitter = () => (random() - 0.5) * 0.06;
  const arch: Limb = {
    points: [
      { x: -0.66, y: -0.06, z: 0 },
      { x: -0.46, y: 0.12, z: 0.02 },
      { x: -0.26, y: 0.28 + jitter(), z: 0.04 },
      { x: 0, y: 0.36 + jitter(), z: jitter() },
      { x: 0.26, y: 0.28 + jitter(), z: -0.04 },
      { x: 0.46, y: 0.12, z: -0.02 },
      { x: 0.66, y: -0.06, z: 0 },
    ],
    radii: [0.08, 0.07, 0.064, 0.058, 0.062, 0.068, 0.076],
  };
  const top = arch.points[3];
  const stub: Limb = {
    points: [
      { x: top.x + 0.05, y: top.y, z: top.z },
      { x: top.x + 0.12, y: top.y + 0.14, z: top.z + 0.1 },
    ],
    radii: [0.026, 0.008],
  };
  return [arch, stub];
}

export function archPerches(random: () => number): PlantPerch[] {
  const [arch] = archLimbs(random);
  const up = alongTop(arch, [0.05, 0.18, 0.33]);
  const top = alongTop(arch, [0.5]);
  return [
    {
      stem: up.points,
      barkNormals: up.normals,
      perch: top.points[0],
      perchNormal: top.normals[0],
    },
  ];
}

/** An upright branch that splits in two, too steep for frogs that can't
 * climb. */
export function forkedBranchLimbs(random: () => number): Limb[] {
  const jitter = () => (random() - 0.5) * 0.06;
  const main: Limb = {
    points: [
      { x: -0.22, y: -0.05, z: 0 },
      { x: -0.1, y: 0.25, z: jitter() },
      { x: 0, y: 0.52, z: jitter() },
    ],
    radii: [0.09, 0.074, 0.06],
  };
  const fork = main.points[2];
  const right: Limb = {
    points: [
      { x: fork.x, y: fork.y - 0.03, z: fork.z },
      { x: fork.x + 0.12, y: fork.y + 0.2, z: fork.z + 0.08 },
      { x: fork.x + 0.2, y: fork.y + 0.4 + jitter(), z: fork.z + 0.12 },
    ],
    radii: [0.05, 0.036, 0.016],
  };
  const left: Limb = {
    points: [
      { x: fork.x - 0.02, y: fork.y - 0.03, z: fork.z },
      { x: fork.x - 0.15, y: fork.y + 0.16, z: fork.z - 0.1 },
      { x: fork.x - 0.32, y: fork.y + 0.28 + jitter(), z: fork.z - 0.2 },
    ],
    radii: [0.044, 0.03, 0.012],
  };
  const twig: Limb = {
    points: [
      { x: -0.12, y: 0.2, z: main.points[1].z },
      { x: -0.02, y: 0.3, z: main.points[1].z + 0.16 },
    ],
    radii: [0.022, 0.007],
  };
  return [main, right, left, twig];
}

export function forkedBranchPerches(random: () => number): PlantPerch[] {
  const [main, right, left] = forkedBranchLimbs(random);
  const up = alongTop(main, [0.06, 0.4, 0.75]);
  return [right, left].map((arm) => {
    const along = alongTop(arm, [0.35, 0.85]);
    return {
      stem: [...up.points, along.points[0]],
      barkNormals: [...up.normals, along.normals[0]],
      perch: along.points[1],
      perchNormal: along.normals[1],
    };
  });
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

/** How tall the strangler fig's trunk stands, how many roots make it, and
 * how far out they flare at the ground. */
const FIG_HEIGHT = 1.55,
  FIG_STRANDS = 11,
  FIG_SPREAD = 0.56;

/** Where each of the strangler fig's roots meets the ground, at the foot of
 * its buttress. */
export const FIG_ROOT_ENDS = Array.from({ length: FIG_STRANDS }, (_, i) => ({
  x: Math.cos((i / FIG_STRANDS) * Math.PI * 2) * FIG_SPREAD,
  z: Math.sin((i / FIG_STRANDS) * Math.PI * 2) * FIG_SPREAD,
}));

/** A strangler fig's trunk: roots flared at the base climb and wind around a
 * hollow where its host tree rotted away, crossing and fusing into a
 * lattice. No two roots are alike: they differ in thickness and path, a few
 * fuse into their neighbors partway up, and one hangs loose from the crown.
 * At the top, three uneven branches reach out. */
export function figLimbs(random: () => number): Limb[] {
  const between = (low: number, high: number) => low + random() * (high - low);
  const heights = [-0.06, 0.08, 0.26, 0.5, 0.78, 1.06, 1.32, FIG_HEIGHT];
  // Out from the hollow at each height: a wide buttress, then a column that
  // narrows into the crown, where the branches hide the roots' ends.
  const reach = [FIG_SPREAD, 0.4, 0.27, 0.21, 0.2, 0.19, 0.16, 0.08];
  const radii = [0.11, 0.09, 0.078, 0.072, 0.068, 0.064, 0.058, 0.045];
  const strands = Array.from({ length: FIG_STRANDS }, (_, i): Limb => {
    const start = (i / FIG_STRANDS) * Math.PI * 2;
    // Neighbors wind opposite ways, most of a turn, so they cross often.
    const twist = (i % 2 ? 1 : -1) * between(1.4, 2.6);
    const girth = between(0.65, 1.3);
    // Odd roots that climbers don't use may fuse into the trunk early.
    const ends = i % 2 && random() < 0.5 ? Math.floor(between(4, 6)) : 8;
    return {
      points: heights.slice(0, ends).map((y, k) => {
        // The flared foot keeps one shape, so every root sinks into a slope
        // the same way; above it, each root bulges and kinks its own way.
        const free = k > 1;
        const wander = free ? between(-0.25, 0.25) : 0;
        const angle = start + (twist * Math.max(0, y)) / FIG_HEIGHT + wander;
        const out = reach[k] * (free ? between(0.8, 1.25) : 1);
        return {
          x: Math.cos(angle) * out,
          y: y + (free ? between(-0.05, 0.05) : 0),
          z: Math.sin(angle) * out,
        };
      }),
      radii: radii
        .slice(0, ends)
        .map((r, k) =>
          k === 0
            ? r
            : k === ends - 1 && ends < 8
              ? r * girth * 0.5
              : r * girth,
        ),
    };
  });
  // A thick, lopsided knot of fused roots at the crown.
  const lean = between(-0.06, 0.06);
  const crown: Limb = {
    points: [
      { x: 0, y: FIG_HEIGHT - 0.22, z: 0 },
      { x: lean, y: FIG_HEIGHT + between(0, 0.12), z: -lean },
    ],
    radii: [0.17, between(0.12, 0.16)],
  };
  // Three branches of different lengths and heights, unevenly spaced.
  const branches = [0, 1, 2].map((i): Limb => {
    const angle = (i / 3) * Math.PI * 2 + between(-0.45, 0.45);
    const length = between(0.42, 0.75);
    const lift = between(0.02, 0.3);
    const at = (fraction: number, rise: number) => ({
      x: Math.cos(angle) * (0.05 + (length - 0.05) * fraction),
      y: FIG_HEIGHT - 0.12 + rise,
      z: Math.sin(angle) * (0.05 + (length - 0.05) * fraction),
    });
    return {
      points: [at(0, 0), at(0.5, lift * 0.8 + 0.1), at(1, lift)],
      radii: [0.075, 0.048 * between(0.8, 1.2), 0.022],
    };
  });
  // An aerial root hanging from one branch, not yet reaching the ground.
  const hanger = branches[Math.floor(random() * 3)].points[1];
  const drop = between(0.5, 0.8);
  const aerial: Limb = {
    points: [0, 0.5, 1].map((t) => ({
      x: hanger.x * (1 + 0.1 * t),
      y: hanger.y - drop * t,
      z: hanger.z * (1 + 0.1 * t),
    })),
    radii: [0.022, 0.015, 0.008],
  };
  return [...strands, crown, ...branches, aerial];
}

/** Climbers go up the outside of a root, around the trunk's crown, and out
 * along a branch. */
export function figPerches(random: () => number): PlantPerch[] {
  const limbs = figLimbs(random);
  const branches = limbs.slice(FIG_STRANDS + 1, FIG_STRANDS + 4);
  return branches.map((branch, i) => {
    const root = limbs[i * 2];
    const outside = root.points.slice(1).map((point, k) => {
      const out = Math.hypot(point.x, point.z);
      const normal = { x: point.x / out, y: 0, z: point.z / out };
      const lift = root.radii[k + 1] + 0.008;
      return {
        point: {
          x: point.x + normal.x * lift,
          y: point.y,
          z: point.z + normal.z * lift,
        },
        normal,
      };
    });
    const along = alongTop(branch, [0.4, 0.9]);
    return {
      stem: [...outside.map((o) => o.point), along.points[0]],
      barkNormals: [...outside.map((o) => o.normal), along.normals[0]],
      perch: along.points[1],
      perchNormal: along.normals[1],
    };
  });
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
