import { createObjectId } from "./objectId";
import type { AssetKind, Environment, HabitatObject } from "./schema";
import { objectBase } from "./stacking";
import { groundHeight } from "./terrain";

/** One stone of a prebuilt, placed relative to the prebuilt's center. A
 * piece `on` an earlier one rests `height` above that piece's base. */
interface Piece {
  kind: AssetKind;
  x: number;
  z: number;
  rotation?: number;
  scale?: number;
  on?: number;
  height?: number;
}

/** A ready-made arrangement of stones. Placing one adds each stone as its
 * own object, stacked as it would be if built by hand. */
export interface Prebuilt {
  id: string;
  name: string;
  description: string;
  /** How far the pieces reach from the center, to keep them inside the tank. */
  radius: number;
  pieces: Piece[];
}

export const prebuilts: Prebuilt[] = [
  {
    id: "rock-shelter",
    name: "Rock shelter",
    description:
      "A capstone resting on standing stones, with a gap beneath for frogs to hide in.",
    radius: 0.66,
    pieces: [
      { kind: "standing-stone", x: -0.44, z: 0, rotation: 0.3 },
      { kind: "standing-stone", x: 0.45, z: 0.02, rotation: -0.4 },
      { kind: "standing-stone", x: 0, z: -0.34, rotation: 1.4, scale: 0.8 },
      {
        kind: "capstone",
        x: 0.02,
        z: -0.03,
        rotation: 0.15,
        on: 0,
        height: 0.32,
      },
    ],
  },
  {
    id: "slab-cave",
    name: "Slab cave",
    description:
      "A thin slab laid across two blocks, with cobbles at the mouth.",
    radius: 0.62,
    pieces: [
      { kind: "stone-block", x: -0.3, z: 0, rotation: 0.2 },
      { kind: "stone-block", x: 0.3, z: 0.02, rotation: 1.1 },
      { kind: "stone-slab", x: 0, z: 0, on: 0, height: 0.27 },
      { kind: "cobble", x: 0.55, z: 0.32 },
      { kind: "cobble", x: -0.5, z: 0.35, scale: 0.85 },
    ],
  },
  {
    id: "stacked-wall",
    name: "Stacked wall",
    description:
      "Blocks laid in three courses, wide at the bottom and narrowing to the top.",
    radius: 0.6,
    pieces: [
      { kind: "stone-block", x: -0.36, z: 0, rotation: 0.1 },
      { kind: "stone-block", x: 0, z: 0, rotation: 1.6 },
      { kind: "stone-block", x: 0.36, z: 0, rotation: -0.2 },
      {
        kind: "stone-block",
        x: -0.18,
        z: 0,
        rotation: 0.9,
        on: 0,
        height: 0.27,
      },
      {
        kind: "stone-block",
        x: 0.18,
        z: 0,
        rotation: 2.3,
        on: 2,
        height: 0.27,
      },
      { kind: "stone-block", x: 0, z: 0, rotation: 0.4, on: 3, height: 0.27 },
    ],
  },
  {
    id: "cairn",
    name: "Cairn",
    description: "Two blocks and a cobble balanced in a small tower.",
    radius: 0.3,
    pieces: [
      { kind: "stone-block", x: 0, z: 0 },
      {
        kind: "stone-block",
        x: 0,
        z: 0,
        rotation: 1.2,
        scale: 0.85,
        on: 0,
        height: 0.27,
      },
      { kind: "cobble", x: 0, z: 0, on: 1, height: 0.23 },
    ],
  },
  {
    id: "boulder-cluster",
    name: "Boulder cluster",
    description:
      "A river stone with a standing stone at its shoulder and cobbles scattered around.",
    radius: 0.75,
    pieces: [
      { kind: "rock", x: 0, z: 0, scale: 1.2 },
      { kind: "standing-stone", x: 0.5, z: -0.25, rotation: 0.6 },
      { kind: "cobble", x: 0.48, z: 0.32 },
      { kind: "cobble", x: -0.55, z: 0.3, scale: 0.9 },
      { kind: "cobble", x: 0.72, z: 0.1, scale: 1.1 },
    ],
  },
];

/** The objects a prebuilt becomes when placed at x, z and turned by
 * `rotation`, the same way Three.js turns a model about its vertical axis. */
export function prebuiltObjects(
  prebuilt: Prebuilt,
  x: number,
  z: number,
  rotation: number,
  env: Environment,
  random = Math.random,
): HabitatObject[] {
  const cos = Math.cos(rotation),
    sin = Math.sin(rotation);
  const objects: HabitatObject[] = [];
  for (const piece of prebuilt.pieces) {
    const object: HabitatObject = {
      id: createObjectId(),
      kind: piece.kind,
      x: x + piece.x * cos + piece.z * sin,
      z: z - piece.x * sin + piece.z * cos,
      rotation: rotation + (piece.rotation ?? 0),
      scale: piece.scale ?? 1,
      seed: Math.floor(random() * 2147483647),
    };
    if (piece.on !== undefined) {
      const support = objects[piece.on];
      object.support = support.id;
      object.lift = Math.max(
        0,
        objectBase(support, env) +
          (piece.height ?? 0) -
          groundHeight(object.x, object.z, env),
      );
    }
    objects.push(object);
  }
  return objects;
}
