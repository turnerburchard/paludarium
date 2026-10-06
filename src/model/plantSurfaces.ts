import type { HabitatObject } from "./schema";

export interface PlantPoint {
  x: number;
  y: number;
  z: number;
}
/** A route from where an object meets the ground to a resting spot. */
export interface PlantPerch {
  stem: PlantPoint[];
  perch: PlantPoint;
  perchNormal: PlantPoint;
  /** Routes over wood follow the top of the bark, with a surface normal for
   * each stem point. Plant stems have none and face outward. */
  barkNormals?: PlantPoint[];
}
/** A sheltered spot inside an object, reached from an entrance on open ground.
 * Heights are above the ground beneath each point. */
export interface Den {
  entrance: PlantPoint;
  inside: PlantPoint;
}
export interface MonsteraLeaf extends PlantPerch {
  tip: PlantPoint;
  direction: PlantPoint;
  normal: PlantPoint;
  length: number;
  width: number;
}
const normalized = ({ x, y, z }: PlantPoint): PlantPoint => {
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
};

/** Shared, seeded leaf geometry for rendering and navigation. Perches sit on
 * the curved midrib, clear of the fenestrations. Existing silhouettes stay put. */
export function monsteraLeaves(random: () => number): MonsteraLeaf[] {
  return Array.from({ length: 7 }, (_, index) => {
    const angle = index * 2.399 + random() * 0.3;
    const height = 0.7 + random() * 0.95;
    const reach = 0.25 + height * 0.23;
    const tip = {
      x: Math.cos(angle) * reach,
      y: height,
      z: Math.sin(angle) * reach,
    };
    const direction = normalized({
      x: Math.cos(angle) * 0.85,
      y: 0.15 + random() * 0.35,
      z: Math.sin(angle) * 0.85,
    });
    // Rotation from local +Y to the leaf direction, applied to its local +Z.
    const normal = {
      x: (-direction.x * direction.z) / (1 + direction.y),
      y: -direction.z,
      z: 1 - direction.z ** 2 / (1 + direction.y),
    };
    const length = 0.65 + height * 0.15;
    const t = 0.42;
    const bend = 0.16 * Math.sin(t * Math.PI) * length;
    const slope = 0.16 * Math.PI * Math.cos(t * Math.PI);
    const perch = {
      x: tip.x + direction.x * length * t + normal.x * bend,
      y: tip.y + direction.y * length * t + normal.y * bend,
      z: tip.z + direction.z * length * t + normal.z * bend,
    };
    let perchNormal = normalized({
      x: normal.x - direction.x * slope,
      y: normal.y - direction.y * slope,
      z: normal.z - direction.z * slope,
    });
    if (perchNormal.y < 0)
      perchNormal = { x: -perchNormal.x, y: -perchNormal.y, z: -perchNormal.z };
    const stem = [
      { x: 0, y: 0, z: 0 },
      { x: tip.x * 0.2, y: height * 0.6, z: tip.z * 0.2 },
      tip,
    ];
    return {
      tip,
      direction,
      normal,
      length,
      width: 0.68,
      stem,
      perch,
      perchNormal,
    };
  });
}

/** Apply the serialized instance transform without depending on Three.js. */
export function transformPlantPoint(
  point: PlantPoint,
  object: HabitatObject,
  baseY = 0,
): PlantPoint {
  const c = Math.cos(object.rotation),
    s = Math.sin(object.rotation);
  return {
    x: object.x + object.scale * (point.x * c + point.z * s),
    y: baseY + point.y * object.scale,
    z: object.z + object.scale * (-point.x * s + point.z * c),
  };
}
export function bromeliadLeaves(random: () => number): MonsteraLeaf[] {
  return Array.from({ length: 13 }, (_, index) => {
    const angle = index * 2.4;
    const direction = normalized({
      x: Math.cos(angle) * 0.7,
      y: 0.3 + random() * 0.5,
      z: Math.sin(angle) * 0.7,
    });
    const length = 0.6 + random() * 0.2;
    const normal = {
      x: (-direction.x * direction.z) / (1 + direction.y),
      y: -direction.z,
      z: 1 - direction.z ** 2 / (1 + direction.y),
    };
    const tip = { x: 0, y: 0.03, z: 0 };
    const t = 0.42,
      bend = 0.16 * Math.sin(t * Math.PI) * length;
    const perch = {
      x: direction.x * length * t + normal.x * bend,
      y: tip.y + direction.y * length * t + normal.y * bend,
      z: direction.z * length * t + normal.z * bend,
    };
    const slope = 0.16 * Math.PI * Math.cos(t * Math.PI);
    let perchNormal = normalized({
      x: normal.x - direction.x * slope,
      y: normal.y - direction.y * slope,
      z: normal.z - direction.z * slope,
    });
    if (perchNormal.y < 0)
      perchNormal = { x: -perchNormal.x, y: -perchNormal.y, z: -perchNormal.z };
    return {
      tip,
      direction,
      normal,
      length,
      width: 0.16,
      stem: [tip],
      perch,
      perchNormal,
    };
  });
}

export function fernFronds(random: () => number) {
  return Array.from({ length: 9 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 9 + random() * 0.2;
    const length = 0.7 + random() * 0.5;
    const direction = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
    // Each frond rises from the crown and arches out and down to its tip.
    const points = Array.from({ length: 9 }, (_, j) => ({
      x: ((direction.x * j) / 8) * length * 0.85,
      y: Math.sin((j / 8) * Math.PI * 0.92) * length * 0.48 + (j / 8) * 0.04,
      z: ((direction.z * j) / 8) * length * 0.85,
    }));
    return { angle, direction, points };
  });
}

export function fernPerches(random: () => number): PlantPerch[] {
  return fernFronds(random).map(({ points }) => ({
    stem: points.slice(0, 5),
    perch: { ...points[4], y: points[4].y + 0.004 },
    perchNormal: { x: 0, y: 1, z: 0 },
  }));
}

export interface AnthuriumLeaf extends PlantPerch {
  /** Where the leaf stalk meets the blade, and the blade's frame there. */
  base: PlantPoint;
  direction: PlantPoint;
  normal: PlantPoint;
  length: number;
  width: number;
  /** How far the tip hangs below a flat blade, as a fraction of its length. */
  droop: number;
}

/** Heart-shaped leaves held out almost level on arching stalks, so the broad
 * base of each blade makes a natural perch. */
export function anthuriumLeaves(random: () => number): AnthuriumLeaf[] {
  return Array.from({ length: 7 }, (_, index) => {
    const angle = index * 2.399 + random() * 0.4;
    const height = 0.38 + random() * 0.42;
    const reach = 0.12 + height * 0.3;
    const base = {
      x: Math.cos(angle) * reach,
      y: height,
      z: Math.sin(angle) * reach,
    };
    const direction = normalized({
      x: Math.cos(angle),
      y: -0.12 - random() * 0.18,
      z: Math.sin(angle),
    });
    // The blade faces up, square to the midrib.
    const normal = normalized({
      x: -direction.x * direction.y,
      y: 1 - direction.y * direction.y,
      z: -direction.z * direction.y,
    });
    const length = 0.42 + height * 0.25 + random() * 0.08;
    const width = length * 0.8;
    const droop = 0.12 + random() * 0.08;
    // Perch on the midrib a third of the way out, where the blade is still level.
    const t = 0.33;
    const sag = -droop * t * t * length;
    const slope = -2 * droop * t;
    const perch = {
      x: base.x + direction.x * length * t + normal.x * (sag + 0.004),
      y: base.y + direction.y * length * t + normal.y * (sag + 0.004),
      z: base.z + direction.z * length * t + normal.z * (sag + 0.004),
    };
    const perchNormal = normalized({
      x: normal.x - direction.x * slope,
      y: normal.y - direction.y * slope,
      z: normal.z - direction.z * slope,
    });
    const stem = [
      { x: 0, y: 0, z: 0 },
      { x: base.x * 0.2, y: height * 0.75, z: base.z * 0.2 },
      { x: base.x * 0.7, y: height + 0.06, z: base.z * 0.7 },
      base,
    ];
    return {
      base,
      direction,
      normal,
      length,
      width,
      droop,
      stem,
      perch,
      perchNormal,
    };
  });
}

export interface VineLeaf {
  /** Where the leaf stalk meets the blade, and the blade's frame there. */
  base: PlantPoint;
  direction: PlantPoint;
  normal: PlantPoint;
  length: number;
  width: number;
  droop: number;
  /** How far up the vine the leaf grows, as an index into its path. */
  node: number;
}

/** A heartleaf vine spiralling up a cork pole. Its leaves grow larger as it
 * climbs, as climbing philodendrons do, and only the big upper leaves hold a
 * frog; the way up is along the vine itself. */
export function philodendronVine(random: () => number) {
  const height = 1.15 + random() * 0.2;
  const poleRadius = 0.085;
  const turns = 2.3 + random() * 0.5;
  const phase = random() * Math.PI * 2;
  const vine = Array.from({ length: 25 }, (_, i): PlantPoint => {
    const t = i / 24;
    const angle = phase + t * turns * Math.PI * 2;
    return {
      x: Math.cos(angle) * (poleRadius + 0.014),
      y: 0.02 + t * (height - 0.08),
      z: Math.sin(angle) * (poleRadius + 0.014),
    };
  });
  const leaves = Array.from({ length: 16 }, (_, i): VineLeaf => {
    const node = 1 + Math.round(i * 1.45);
    const at = vine[node];
    const t = node / 24;
    const out = normalized({ x: at.x, y: 0, z: at.z });
    const direction = normalized({
      x: out.x,
      y: -0.15 - random() * 0.2,
      z: out.z,
    });
    const normal = normalized({
      x: -direction.x * direction.y,
      y: 1 - direction.y * direction.y,
      z: -direction.z * direction.y,
    });
    const length = 0.12 + t * t * 0.25 + random() * 0.04;
    return {
      base: {
        x: at.x + out.x * 0.04,
        y: at.y + 0.02,
        z: at.z + out.z * 0.04,
      },
      direction,
      normal,
      length,
      width: length * 0.78,
      droop: 0.1 + random() * 0.06,
      node,
    };
  });
  return { height, poleRadius, vine, leaves };
}

export function philodendronPerches(random: () => number): PlantPerch[] {
  const { vine, leaves } = philodendronVine(random);
  return leaves
    .filter((leaf) => leaf.length > 0.28)
    .map((leaf) => {
      const t = 0.35;
      const sag = -leaf.droop * t * t * leaf.length;
      const slope = -2 * leaf.droop * t;
      return {
        stem: [{ x: 0, y: 0, z: 0 }, ...vine.slice(0, leaf.node + 1)],
        perch: {
          x:
            leaf.base.x +
            leaf.direction.x * leaf.length * t +
            leaf.normal.x * (sag + 0.004),
          y:
            leaf.base.y +
            leaf.direction.y * leaf.length * t +
            leaf.normal.y * (sag + 0.004),
          z:
            leaf.base.z +
            leaf.direction.z * leaf.length * t +
            leaf.normal.z * (sag + 0.004),
        },
        perchNormal: normalized({
          x: leaf.normal.x - leaf.direction.x * slope,
          y: leaf.normal.y - leaf.direction.y * slope,
          z: leaf.normal.z - leaf.direction.z * slope,
        }),
      };
    });
}

export interface NestFrond extends PlantPerch {
  base: PlantPoint;
  direction: PlantPoint;
  normal: PlantPoint;
  length: number;
  width: number;
  droop: number;
}

/** Broad fronds rising from a central nest and arching outward, sturdy enough
 * for a frog part way along. */
export function nestFernFronds(random: () => number): NestFrond[] {
  return Array.from({ length: 11 }, (_, index) => {
    const angle = index * 2.399 + random() * 0.3;
    const rise = 1.1 + random() * 0.6;
    const direction = normalized({
      x: Math.cos(angle),
      y: rise,
      z: Math.sin(angle),
    });
    const normal = normalized({
      x: -direction.x * direction.y,
      y: 1 - direction.y * direction.y,
      z: -direction.z * direction.y,
    });
    const length = 0.6 + random() * 0.25;
    const droop = 0.3 + random() * 0.12;
    const base = { x: direction.x * 0.04, y: 0.05, z: direction.z * 0.04 };
    const t = 0.4;
    const sag = -droop * t * t * length + 0.005;
    const slope = -2 * droop * t;
    const perch = {
      x: base.x + direction.x * length * t + normal.x * sag,
      y: base.y + direction.y * length * t + normal.y * sag,
      z: base.z + direction.z * length * t + normal.z * sag,
    };
    return {
      base,
      direction,
      normal,
      length,
      width: 0.24 + random() * 0.06,
      droop,
      stem: [{ x: 0, y: 0, z: 0 }, base],
      perch,
      perchNormal: normalized({
        x: normal.x - direction.x * slope,
        y: normal.y - direction.y * slope,
        z: normal.z - direction.z * slope,
      }),
    };
  });
}
