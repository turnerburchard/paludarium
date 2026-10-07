import { createObjectId } from "./objectId";
import {
  defaultEnvironment,
  AQUARIUM_WATER,
  emptyWorld,
  type AssetKind,
  type HabitatObject,
  type World,
} from "./schema";
import type { MossSpecies } from "./moss";
export type Preset = "empty" | "tropical" | "mountain" | "aquarium";
export function makePreset(preset: Preset): World {
  if (preset === "empty") return emptyWorld();
  let serial = 0;
  const objects: HabitatObject[] = [];
  const add = (
    kind: AssetKind,
    x: number,
    z: number,
    scale = 1,
    rotation = 0,
    moss?: MossSpecies,
  ) =>
    objects.push({
      id: createObjectId(),
      kind,
      x,
      z,
      scale,
      rotation,
      seed: ++serial * 173,
      ...(moss && { moss }),
    });
  if (preset === "aquarium") {
    add("wood", -1.45, -0.35, 1.1, -0.5);
    add("rock", -2.45, -0.95, 1.3, 0.5);
    add("rock", -1.95, 0.85, 0.85, 2);
    add("rock", 0.25, -1.15, 0.9, 1.4);
    add("rock", 1.65, 0.95, 0.7, 2.7);
    add("rock", 2.6, -0.5, 0.5, 0.6);
    for (const [x, z, scale] of [
      [-2.6, 0.3, 1.1],
      [-1.75, -1.25, 1.2],
      [-1.4, 0.85, 1],
      [-0.55, -0.15, 1.2],
      [0.65, -1.45, 1],
      [1.5, 0.45, 1.1],
      [2.55, 0.95, 0.9],
    ])
      add("java-moss", x, z, scale);
    // Eelgrass along the back, swords and rotala through the middle, and the
    // slow growers that like to cling beside the stones and driftwood.
    for (const x of [-2.9, -2.3, -0.9, -0.3, 0.9, 1.5, 2.9])
      add("vallisneria", x, -1.85, 1 + (x % 0.4));
    for (const [kind, x, z, scale] of [
      ["amazon-sword", -0.35, 0.95, 1.1],
      ["amazon-sword", 2.1, -0.9, 0.9],
      ["rotala", -2.95, -1.45, 1],
      ["rotala", 0.2, -1.8, 1.1],
      ["rotala", 2.35, -1.6, 0.9],
      ["anubias", -2.05, -0.3, 1],
      ["anubias", 0.75, -0.85, 0.9],
      ["anubias", -1.45, 1.25, 1],
      ["java-fern", -1.0, -0.8, 1.1],
      ["java-fern", 1.95, 1.35, 1],
    ] as const)
      add(kind, x, z, scale);
    for (const [kind, x, z, heading] of [
      ["cardinal-tetra", -0.7, 0.55, 1.2],
      ["ember-tetra", 1.2, -0.6, 4.2],
    ] as const)
      for (let i = 0; i < 6; i++)
        add(kind, x + (i % 3) * 0.3, z + Math.floor(i / 3) * 0.3, 1, heading);
    // Bigger fish: angelfish and gouramis in the open water, a rainbow shark
    // and a group of corydoras along the bottom.
    for (const [kind, x, z, heading] of [
      ["angelfish", -1.2, -0.4, 0.6],
      ["angelfish", -0.8, -0.7, 0.8],
      ["angelfish", -1.5, -0.9, 0.5],
      ["pearl-gourami", 1.6, 0.2, 3.6],
      ["pearl-gourami", 0.4, 1.1, 2.4],
      ["rainbow-shark", 0.8, 0.3, 1.8],
    ] as const)
      add(kind, x, z, 1, heading);
    for (let i = 0; i < 6; i++)
      add(
        "corydoras",
        -0.2 + (i % 3) * 0.2,
        0.3 + Math.floor(i / 3) * 0.2,
        1,
        2,
      );
    return {
      version: 1,
      name: "Aquarium",
      environment: { ...defaultEnvironment, water: AQUARIUM_WATER },
      objects,
    };
  }
  if (preset === "tropical") {
    add("monstera", -2.15, -1.15, 1.25, 0.3);
    add("monstera", -0.65, -1.45, 0.85, 2.4);
    add("fern", -2.25, 0.9, 1.2, 1);
    add("fern", -0.9, 0.55, 0.8, 3);
    add("bromeliad", -2.6, -0.1, 0.9);
    add("bromeliad", -0.8, -0.6, 0.75, 2);
    add("wood", -1.45, -0.3, 1.05, -0.4);
    add("rock-shelter", 0.1, -1.2, 0.95, 0.4, "sheet");
    add("rock", 0.2, 0.35, 0.8, 1.6, "cushion");
    add("rock", 0.55, 1.25, 0.6, 1);
    add("rock", 1.6, -1.55, 0.65);
    add("moss", -1.9, 0.35, 1.15);
    add("fern-moss", -0.35, -1, 0.8);
    add("grass", -0.1, 0.8, 0.9);
    add("grass", -0.15, -1.6, 0.8);
    add("tree-frog", -1.25, 1.15, 1.2, -0.5);
    add("dart-frog", -2.6, 0.6, 1.15, 1);
    add("fish", 2.05, 0.25, 1);
    add("fish", 1.6, 0.9, 0.8, 2);
  } else {
    add("rock", -1.65, -0.65, 1.8, 0.6, "sheet");
    add("rock", -0.5, -1.4, 1.2, 2);
    add("rock", -2.5, -1.25, 0.85);
    add("rock", 0.3, 0.65, 1.0, 2, "fern");
    add("rock", 0.75, 1.5, 0.55);
    add("wood", -1.3, 0.15, 0.8, 1.2);
    add("fern", -2.6, -0.3, 1.1);
    add("fern", -1.2, -1.5, 0.9, 1);
    add("strawberry", -2.1, 1.15, 1.2);
    add("strawberry", -0.8, 0.9, 1.1, 1);
    add("strawberry", -2.75, 0.6, 0.8, 2);
    add("grass", -0.1, -0.9, 1.1);
    add("grass", -0.2, 1.4, 0.8);
    add("moss", -1.6, 0.8, 1.2);
    add("moss", -2.2, -0.1, 1.2);
    // Animals of Utah's mountain creeks: a canyon tree frog for the boulders
    // by the water and a fence lizard basking on the bank.
    add("canyon-tree-frog", -0.9, 0.2, 1.2, 0.4);
    add("fence-lizard", -0.35, -0.45, 1.1, 2.2);
  }
  // A few overlapping ground-cover clusters make the ready-made habitats feel established.
  for (const [kind, x, z, scale] of [
    ["sheet-moss", -2.6, -1.6, 1.2],
    ["fern-moss", -2, -1.5, 1.1],
    ["sheet-moss", -1.4, -1.1, 1.25],
    ["sheet-moss", -2.5, 0.2, 1.4],
    ["moss", -1.65, 0.8, 1.2],
    ["fern-moss", -0.75, 1.35, 0.8],
    ["sheet-moss", -0.55, -0.45, 0.9],
  ] as const)
    add(kind, x, z, scale);
  if (preset === "tropical") {
    add("monstera", -2.65, -0.7, 0.65, 1.7);
    add("fern", -1.7, -1.4, 1.05, 0.5);
    add("fern", -0.65, -0.1, 0.65, 1.6);
    add("strawberry", -2.3, 1.45, 0.85, 0.3);
    add("philodendron", -3.0, -1.75, 1.1);
    add("anthurium", -1.35, 0.4, 0.85, 1.2);
    add("log", -1.75, 1.75, 0.8, 0.2, "fern");
    add("leaf-litter", -1.05, 1.05, 1);
    add("nest-fern", -2.75, 1.05, 0.9, 0.4);
    add("swiss-cheese-plant", -1.25, -1.85, 0.75, 1.1);
    add("calathea", -0.15, -0.55, 0.9, 2.2);
    add("calathea", -2.05, -0.55, 0.8, 0.7);
    add("fittonia", -0.35, 1.45, 1);
    add("fittonia", -1.55, 0.35, 0.9);
    add("fittonia", 0.05, 0.05, 0.85);
    add("nest-fern", -0.55, -1.25, 0.7, 2.8);
    add("turtle", -0.6, 0.95, 1, 2.4);
    add("java-moss", 1.7, 1.35, 1.1);
    add("java-moss", 2.45, 0.35, 0.9);
    for (const [x, z, turn] of [
      [1.75, 0.95, 1.2],
      [1.95, 1.15, 1.3],
      [2.1, 0.85, 1.1],
      [1.85, 0.7, 1.25],
      [2.25, 1.05, 1.2],
      [2.0, 0.55, 1.35],
    ])
      add("cardinal-tetra", x, z, 1, turn);
  } else {
    add("log", -1.65, 1.75, 0.8, 0.1, "sheet");
    add("leaf-litter", -1.85, 0.35, 0.9);
    add("branch", -0.4, -0.55, 1, 2.6);
    add("cattail", 0.85, -1.35, 1, 0.4);
    add("cattail", 1.05, -1.75, 0.85, 2);
    add("snail", -1.0, 1.0, 1, 1.4);
    add("java-moss", 2.7, -0.75, 1);
    for (const [x, z] of [
      [2.1, -0.2],
      [2.35, 0.05],
      [2.2, 0.3],
      [2.5, -0.35],
      [2.6, 0.2],
    ])
      add("tiger-barb", x, z, 1, 4.2);
  }
  return {
    version: 1,
    name: preset === "tropical" ? "Cloud forest" : "Alpine creek",
    environment: {
      ...defaultEnvironment,
      light: preset === "tropical" ? "day" : "golden",
    },
    objects,
  };
}
