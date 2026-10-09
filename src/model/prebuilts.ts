import { createObjectId } from "./objectId";
import type { MossSpecies } from "./moss";
import type { AssetKind, Environment, HabitatObject } from "./schema";
import { objectBase } from "./stacking";
import { groundHeight, placementProblem } from "./terrain";

/** One object of a prebuilt, placed relative to the prebuilt's center. A
 * piece `on` an earlier one rests `height` above that piece's base. */
interface Piece {
  kind: AssetKind;
  x: number;
  z: number;
  rotation?: number;
  scale?: number;
  moss?: MossSpecies;
  on?: number;
  height?: number;
}

/** A ready-made arrangement of stones, wood and plants. Placing one adds
 * each piece as its own object, stacked as it would be if built by hand. */
export interface Prebuilt {
  id: string;
  name: string;
  description: string;
  /** How far the pieces reach from the center, to keep them inside the tank. */
  radius: number;
  pieces: Piece[];
}

/** A capstone on standing stones, which presets dress with their own plants. */
export const rockShelter: Prebuilt = {
  id: "rock-shelter",
  name: "Rock shelter",
  description: "A capstone resting on standing stones.",
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
};

export const prebuilts: Prebuilt[] = [
  {
    id: "mossy-shelter",
    name: "Mossy shelter",
    description:
      "A moss-topped capstone on standing stones, with a fern and fittonia at its sides and leaf litter at the mouth.",
    radius: 1.05,
    pieces: [
      ...rockShelter.pieces.slice(0, 3),
      { ...rockShelter.pieces[3], moss: "sheet" },
      { kind: "fern", x: -0.8, z: -0.25, rotation: 0.5, scale: 0.75 },
      { kind: "fittonia", x: 0.8, z: 0.3, scale: 0.8 },
      { kind: "leaf-litter", x: 0.05, z: 0.5, scale: 0.6 },
      { kind: "cobble", x: 0.45, z: 0.6, scale: 0.9 },
      { kind: "cobble", x: -0.5, z: 0.45, rotation: 1.3, scale: 1.1 },
    ],
  },
  {
    id: "slab-cave",
    name: "Slab cave",
    description:
      "A cushion-mossed slab laid across two blocks, with cobbles scattered at the mouth.",
    radius: 0.9,
    pieces: [
      { kind: "stone-block", x: -0.3, z: 0, rotation: 0.2 },
      { kind: "stone-block", x: 0.3, z: 0.02, rotation: 1.1 },
      { kind: "stone-slab", x: 0, z: 0, moss: "cushion", on: 0, height: 0.22 },
      { kind: "cobble", x: 0.55, z: 0.35 },
      { kind: "cobble", x: -0.5, z: 0.38, rotation: 2, scale: 0.85 },
      { kind: "cobble", x: 0.72, z: -0.08, rotation: 0.7, scale: 0.7 },
      { kind: "sheet-moss", x: -0.6, z: -0.3, scale: 0.6 },
    ],
  },
  {
    id: "granite-outcrop",
    name: "Granite outcrop",
    description:
      "Two granite boulders, one cushioned with moss, above a spill of scree, a flat stone and tufts of grass.",
    radius: 1.1,
    pieces: [
      { kind: "granite", x: 0, z: 0, rotation: 0.4, moss: "cushion" },
      { kind: "granite", x: 0.65, z: 0.3, rotation: 2.1, scale: 0.55 },
      { kind: "scree", x: -0.55, z: 0.4, scale: 0.9 },
      { kind: "flagstone", x: 0.15, z: 0.7, rotation: 1, scale: 0.8 },
      { kind: "grass", x: -0.5, z: -0.35, scale: 0.8 },
      { kind: "grass", x: 0.9, z: -0.2, rotation: 1.4, scale: 0.7 },
      { kind: "cobble", x: 0.95, z: 0.5 },
    ],
  },
  {
    id: "desert-ledge",
    name: "Desert ledge",
    description:
      "A banded sandstone boulder beside a stepped ledge, with pebbles and a pair of hedgehog cacti.",
    radius: 1.1,
    pieces: [
      { kind: "sandstone", x: 0, z: 0, rotation: 0.3 },
      { kind: "sandstone-ledge", x: 0.6, z: 0.25, rotation: 1.1, scale: 0.75 },
      { kind: "pebbles", x: -0.55, z: 0.45, scale: 0.9 },
      { kind: "hedgehog-cactus", x: -0.5, z: -0.3, scale: 0.85 },
      { kind: "hedgehog-cactus", x: 0.95, z: -0.25, rotation: 2, scale: 0.7 },
    ],
  },
  {
    id: "root-tangle",
    name: "Root tangle",
    description:
      "Gnarled tree roots over a patch of moss, with mushrooms, leaf litter and a fern.",
    radius: 1.1,
    pieces: [
      { kind: "tree-roots", x: 0, z: 0, scale: 1.3 },
      { kind: "sheet-moss", x: 0.1, z: 0.45, scale: 0.7 },
      { kind: "bonnet-mushrooms", x: -0.5, z: 0.3, scale: 0.8 },
      { kind: "leaf-litter", x: 0.45, z: 0.5, scale: 0.6 },
      { kind: "fern", x: 0.7, z: -0.3, rotation: 2.4, scale: 0.6 },
      { kind: "cobble", x: -0.7, z: -0.2, scale: 0.9 },
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
      ...(piece.moss && { moss: piece.moss }),
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

/** The first reason any piece can't go where the prebuilt puts it, such as
 * a land plant that would land in water. */
export function prebuiltProblem(objects: HabitatObject[], env: Environment) {
  for (const o of objects) {
    const problem = placementProblem(o.kind, o.x, o.z, env, o.lift);
    if (problem) return problem;
  }
  return null;
}
