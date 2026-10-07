import { createObjectId } from "./objectId";
import {
  defaultEnvironment,
  AQUARIUM_WATER,
  emptyWorld,
  type AssetKind,
  type Environment,
  type HabitatObject,
  type World,
} from "./schema";
import type { MossSpecies } from "./moss";
import { baseGroundHeight } from "./terrain";
import { TERRAIN_POINTS, terrainPoint } from "./terrainData";
export type Preset =
  | "empty"
  | "tropical"
  | "mountain"
  | "desert"
  | "grotto"
  | "aquarium";
type Add = (
  kind: AssetKind,
  x: number,
  z: number,
  scale?: number,
  rotation?: number,
  moss?: MossSpecies,
) => void;
export function makePreset(preset: Preset): World {
  if (preset === "empty") return emptyWorld();
  let serial = 0;
  const objects: HabitatObject[] = [];
  const add: Add = (kind, x, z, scale = 1, rotation = 0, moss) =>
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
    // A sunken root behind the open middle, red ludwigia for color at the side
    // and a carpet of dwarf sagittaria across the front.
    add("tree-roots", 1.3, -0.3, 1, 0.8);
    add("ludwigia", -2.85, 1.4, 1);
    for (const [x, z] of [
      [0.35, 1.65],
      [-0.8, 1.7],
      [2.7, 1.7],
    ])
      add("dwarf-sagittaria", x, z, 1.1);
    return {
      version: 1,
      name: "Aquarium",
      environment: { ...defaultEnvironment, water: AQUARIUM_WATER },
      objects,
    };
  }
  if (preset === "tropical")
    return {
      version: 1,
      name: "Cloud forest",
      environment: { ...defaultEnvironment },
      objects: cloudForest(add, objects),
    };
  if (preset === "mountain")
    return {
      version: 1,
      name: "Alpine creek",
      environment: { ...defaultEnvironment, light: "golden", warmth: 0.3 },
      objects: alpineCreek(add, objects),
    };
  if (preset === "grotto")
    return {
      version: 1,
      name: "Limestone grotto",
      environment: { ...defaultEnvironment, warmth: 0.6, brightness: 0.85 },
      objects: limestoneGrotto(add, objects),
    };
  const environment: Environment = {
    ...defaultEnvironment,
    water: 0.3,
    warmth: 0.8,
    brightness: 1.25,
  };
  environment.terrain = desertSand(environment);
  return {
    version: 1,
    name: "Desert spring",
    environment,
    objects: desertSpring(add, objects),
  };
}

/** A few overlapping ground-cover clusters make a damp habitat feel established. */
function groundCover(add: Add) {
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
}

/** Costa Rican cloud forest: broad leaves, orchids and poison frogs above a
 * pond of convict cichlids. */
function cloudForest(add: Add, objects: HabitatObject[]) {
  add("monstera", -2.15, -1.15, 1.25, 0.3);
  add("monstera", -0.65, -1.45, 0.85, 2.4);
  add("fern", -2.25, 0.9, 1.2, 1);
  add("fern", -0.9, 0.55, 0.8, 3);
  add("bromeliad", -2.6, -0.1, 0.9);
  add("bromeliad", -0.8, -0.6, 0.75, 2);
  add("fungus-log", -1.45, -0.3, 1, -0.4);
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
  groundCover(add);
  add("monstera", -2.65, -0.7, 0.65, 1.7);
  add("fern", -1.7, -1.4, 1.05, 0.5);
  add("fern", -0.65, -0.1, 0.65, 1.6);
  add("orchid", -2.3, 1.45, 1, 0.3);
  add("orchid", -0.25, -0.2, 0.85, 2);
  add("philodendron", -3.0, -1.75, 1.1);
  add("anthurium", -1.35, 0.4, 0.85, 1.2);
  add("log", -1.75, 1.75, 0.8, 0.2, "fern");
  add("leaf-litter", -1.05, 1.05, 1);
  add("nest-fern", -2.75, 1.05, 0.9, 0.4);
  add("tree-philodendron", -1.25, -1.85, 0.8, 1.1);
  add("calathea", -0.15, -0.55, 0.9, 2.2);
  add("calathea", -2.05, -0.55, 0.8, 0.7);
  add("fittonia", -0.35, 1.45, 1);
  add("fittonia", -1.55, 0.35, 0.9);
  add("fittonia", 0.05, 0.05, 0.85);
  add("nest-fern", -0.55, -1.25, 0.7, 2.8);
  add("turtle", -0.6, 0.95, 1, 2.4);
  add("java-moss", 1.7, 1.35, 1.1);
  add("java-moss", 2.45, 0.35, 0.9);
  add("water-lily", 2.6, -0.9, 1, 0.4);
  add("water-lily", 2.75, -1.55, 0.8, 2);
  for (const [x, z, turn] of [
    [1.75, 0.95, 1.2],
    [2.1, 0.75, 1.1],
    [1.95, 0.2, 1.3],
    [2.4, 0.55, 1.25],
  ])
    add("convict-cichlid", x, z, 1, turn);
  add("bonnet-mushrooms", -0.4, 0.5, 1, 0.6);
  add("bonnet-mushrooms", -2.75, 1.75, 0.9, 2);
  return objects;
}

/** A Rocky Mountain creek: spruce, columbine and kinnikinnick on the bank,
 * frogs, a lizard and a salamander, and trout and sculpins in the water. */
function alpineCreek(add: Add, objects: HabitatObject[]) {
  add("granite", -1.65, -0.65, 1.6, 0.6, "sheet");
  add("granite", -0.5, -1.4, 1.1, 2);
  add("slate", -2.5, -1.25, 1);
  add("rock", 1.15, 0.75, 1.0, 2, "fern");
  add("rock", 0.75, 1.5, 0.55);
  add("rock", 1.7, -0.3, 0.7, 1.2);
  add("pebbles", 2.4, 1.1, 1.2, 0.4);
  add("snag", -1.3, 0.15, 0.8, 1.2);
  add("spruce", -2.85, 1.0, 1.15, 0.3);
  add("spruce", -1.1, -1.7, 0.85, 1.2);
  add("fern", -2.6, -0.3, 1.1);
  add("columbine", -2.1, 1.15, 1.1);
  add("columbine", -0.85, 0.85, 0.9, 1);
  add("strawberry", -2.75, 0.6, 0.8, 2);
  add("kinnikinnick", -1.95, -0.05, 1.1, 0.5);
  add("hairgrass", -0.1, -0.9, 1.1);
  add("hairgrass", -0.2, 1.4, 0.9);
  add("moss", -1.6, 0.8, 1.2);
  // A canyon tree frog for the boulders by the water, a fence lizard basking
  // on the bank and a salamander under the log.
  add("canyon-tree-frog", -0.9, 0.2, 1.2, 0.4);
  add("fence-lizard", -0.35, -0.45, 1.1, 2.2);
  add("tiger-salamander", -1.6, 1.4, 1, 1.4);
  groundCover(add);
  add("log", -1.65, 1.75, 0.8, 0.1, "sheet");
  add("leaf-litter", -1.85, 0.35, 0.9);
  add("branch", -0.4, -0.55, 1, 2.6);
  add("cattail", 0.85, -1.35, 1, 0.4);
  add("cattail", 1.05, -1.75, 0.85, 2);
  add("java-moss", 2.7, -0.75, 1);
  add("cutthroat-trout", 2.1, -0.2, 1, 4.2);
  add("cutthroat-trout", 1.5, 0.6, 0.9, 1);
  add("sculpin", 2.2, 0.5, 1, 3);
  add("sculpin", 2.55, -1.1, 1, 0.5);
  add("scree", 0.3, 0.55, 1, 0.8);
  add("flagstone", 0.6, -0.15, 1, 2.1);
  // A fly agaric under the spruce and a bolete out on the bank.
  add("fly-agaric", -2.6, 1.75, 1, 0.4);
  add("bolete", -0.4, 0.85, 1, 1.8);
  return objects;
}

/** A shady Vietnamese limestone grotto for mossy frogs: mossy stone and
 * caves, elephant ears and begonias, and harlequin rasboras in the pool. */
function limestoneGrotto(add: Add, objects: HabitatObject[]) {
  add("rock-shelter", -2.3, -1.2, 1.2, 0.3, "cushion");
  add("rock-shelter", -0.4, -1.35, 0.9, 2.2, "sheet");
  add("limestone", -1.35, -0.55, 1.4, 1, "cushion");
  add("limestone", -2.6, 0.55, 1, 2.5, "sheet");
  add("limestone", 0.2, 0.4, 0.9, 0.7, "fern");
  add("rock", 0.6, 1.4, 0.6, 1.9, "java");
  add("rock", 1.8, -1.3, 0.8, 0.2, "java");
  add("wood", -1.1, 0.75, 0.9, 2.1, "java");
  add("alocasia", -2.8, -1.7, 1.1, 0.5);
  add("alocasia", -1.2, -1.75, 0.8, 2.4);
  add("nest-fern", -1.95, 1.3, 0.9, 1);
  add("begonia", -2.45, -0.3, 1, 0.3);
  add("begonia", -0.7, 0.05, 0.9, 1.6);
  add("begonia", -1.75, 0.35, 0.8, 2.8);
  add("fern", -0.35, 1.35, 0.8, 2);
  add("cryptocoryne", 0.15, -0.6, 1, 0.4);
  add("cryptocoryne", 0.5, 0.9, 0.9, 2);
  add("java-fern", 1.45, 0.75, 1, 1.2);
  add("java-fern", 2.5, -1.4, 0.9, 0.6);
  add("cryptocoryne", 2.1, 1.3, 1, 2.6);
  add("java-moss", 2.75, 0.2, 1);
  add("water-lily", 2.3, -0.3, 1, 1);
  add("mossy-frog", -1.5, -0.1, 1, 0.6);
  add("mossy-frog", -2.1, 0.9, 1, 2.1);
  add("mossy-frog", -0.75, -0.85, 1, 4);
  groundCover(add);
  for (let i = 0; i < 8; i++)
    add(
      "harlequin-rasbora",
      2.2 + (i % 4) * 0.2,
      0.3 + Math.floor(i / 4) * 0.3,
      1,
      4.5,
    );
  add("limestone-pinnacle", 1.0, -1.2, 0.9, 0.6, "java");
  add("bonnet-mushrooms", -2.75, 1.45, 1, 1.1);
  add("bonnet-mushrooms", -1.25, 1.75, 0.85, 2.7);
  return objects;
}

/** A Mojave desert spring: cacti, agave and bunchgrass on dry sand around a
 * small pool of pupfish, with three lizards and a tortoise. */
function desertSpring(add: Add, objects: HabitatObject[]) {
  add("sandstone", -2.4, -1.3, 1.6, 0.4);
  add("sandstone-ledge", -1.55, -1.55, 1, 2.1);
  add("sandstone", 2.3, -1.2, 1.3, 1.2);
  add("sandstone-ledge", 2.7, 1.3, 0.9, 0.3);
  add("sandstone-pillar", -0.8, 1.45, 1, 2.8);
  add("rock-shelter", -2.6, 0.75, 1.1, 1.4);
  add("rock-shelter", 1.7, -1.75, 0.9, 3.4);
  add("branch", -0.6, -1.35, 1.1, 0.9);
  add("prickly-pear", -1.6, -0.5, 1.1, 0.3);
  add("prickly-pear", 2.6, 0.2, 0.9, 1.8);
  add("barrel-cactus", -0.3, -1.6, 1, 0.2);
  add("barrel-cactus", 1.4, 1.5, 0.8, 1);
  add("hedgehog-cactus", -2.9, -0.2, 1, 0.5);
  add("hedgehog-cactus", 0.6, -1.75, 0.9, 2);
  add("hedgehog-cactus", -1.5, 1.55, 1.1, 1);
  add("agave", -2.05, 0.15, 1.1, 0.6);
  add("agave", 2.75, -0.5, 0.9, 2.2);
  add("bunchgrass", -0.85, -0.85, 1, 0.4);
  add("bunchgrass", 0.05, 1.5, 0.9, 1.4);
  add("bunchgrass", -2.95, 1.6, 1);
  add("bunchgrass", 2.1, 1.05, 0.9, 2.5);
  // Rushes and grass where the spring keeps the ground damp.
  add("grass", -0.55, 0.2, 0.8, 0.6);
  add("grass", 1.3, 0.8, 0.7, 2);
  add("leopard-lizard", -1.1, 0.2, 1, 0.8);
  add("desert-spiny-lizard", -2.2, -0.75, 1, 2.6);
  add("chuckwalla", 2.2, 0.85, 1, 3.6);
  add("desert-tortoise", -1.8, 1.0, 1, 2.2);
  for (const [x, z, turn] of [
    [0.35, 0.1, 1],
    [0.6, 0.4, 2.2],
    [0.75, -0.1, 4],
  ])
    add("pupfish", x, z, 1, turn);
  add("flagstone", 1.3, -0.55, 0.9, 1.3);
  add("dead-tree", -1.1, 0.65, 1, 0.9);
  return objects;
}

/** Dry, gently rolling sand that dips in the middle to hold a spring. */
function desertSand(env: Environment): NonNullable<Environment["terrain"]> {
  const heights = Array.from({ length: TERRAIN_POINTS }, (_, i) => {
    const { x, z } = terrainPoint(i, env);
    const dunes = 0.74 + 0.05 * Math.sin(x * 1.3 + z * 0.9);
    const fromSpring = Math.hypot(x - 0.5, (z - 0.15) * 1.3);
    const dip = Math.min(1, Math.max(0, (1.8 - fromSpring) / 1.4));
    const height = dunes - 0.66 * dip * dip * (3 - 2 * dip);
    return Math.max(-0.9, Math.min(0.9, height - baseGroundHeight(x, z, env)));
  });
  return { heights, paint: heights.map(() => "sand") };
}
