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
import { applyTerrainBrush, type TerrainMode } from "./terrainBrush";
import { newTerrain } from "./terrainData";
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
      ["angelfish", -1.0, -0.2, 0.6],
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
    // Cherry shrimp graze the stones and driftwood.
    for (const [x, z, heading] of [
      [-2.0, 0.0, 0.4],
      [1.0, -0.4, 2.2],
      [-1.3, 1.0, 5.1],
    ])
      add("cherry-shrimp", x, z, 1, heading);
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
      environment: aquascape(),
      objects,
    };
  }
  if (preset === "tropical")
    return {
      version: 1,
      name: "Cloud forest",
      environment: forestFloor(),
      objects: cloudForest(add, objects),
    };
  if (preset === "mountain")
    return {
      version: 1,
      name: "Alpine creek",
      environment: creekBed(),
      objects: alpineCreek(add, objects),
    };
  if (preset === "grotto")
    return {
      version: 1,
      name: "Limestone grotto",
      environment: grottoFloor(),
      objects: limestoneGrotto(add, objects),
    };
  return {
    version: 1,
    name: "Desert spring",
    environment: desertBasin(),
    objects: desertSpring(add, objects),
  };
}

/** Costa Rican cloud forest: broad leaves, orchids and poison frogs above a
 * pond of convict cichlids. */
function cloudForest(add: Add, objects: HabitatObject[]) {
  // Dense understory on the high ground to the left of the pool.
  add("monstera", -2.75, -1.15, 1.25, 0.3);
  add("monstera", -1.25, -1.45, 0.85, 2.4);
  add("monstera", -3.25, -0.7, 0.65, 1.7);
  add("philodendron", -3.55, -1.75, 1.1);
  add("tree-philodendron", -1.85, -1.7, 0.8, 1.1);
  add("fern", -2.85, 0.9, 1.2, 1);
  add("fern", -1.5, 0.55, 0.8, 3);
  add("fern", -2.3, -1.4, 1.05, 0.5);
  add("fern", -1.25, -0.1, 0.65, 1.6);
  add("bromeliad", -3.2, -0.1, 0.9);
  add("bromeliad", -1.4, -0.6, 0.75, 2);
  add("fungus-log", -2.05, -0.3, 1, -0.4);
  add("orchid", -2.9, 1.45, 1, 0.3);
  add("orchid", -0.85, -0.2, 0.85, 2);
  add("anthurium", -1.95, 0.4, 0.85, 1.2);
  add("calathea", -0.75, -0.55, 0.9, 2.2);
  add("calathea", -2.65, -0.55, 0.8, 0.7);
  add("nest-fern", -3.35, 1.05, 0.9, 0.4);
  add("nest-fern", -1.15, -1.25, 0.7, 2.8);
  add("fittonia", -0.95, 1.45, 1);
  add("fittonia", -2.15, 0.35, 0.9);
  add("log", -2.35, 1.75, 0.8, 0.2, "fern");
  add("leaf-litter", -1.65, 1.05, 1);
  add("bonnet-mushrooms", -1.0, 0.5, 1, 0.6);
  add("bonnet-mushrooms", -3.35, 1.75, 0.9, 2);
  for (const [kind, x, z, scale] of [
    ["sheet-moss", -3.2, -1.6, 1.2],
    ["fern-moss", -2.6, -1.5, 1.1],
    ["sheet-moss", -3.1, 0.2, 1.4],
    ["moss", -2.5, 0.35, 1.15],
    ["fern-moss", -1.35, 1.35, 0.8],
    ["sheet-moss", -1.15, -0.45, 0.9],
  ] as const)
    add(kind, x, z, scale);
  add("tree-frog", -1.85, 1.15, 1.2, -0.5);
  add("dart-frog", -3.2, 0.6, 1.15, 1);
  add("turtle", -0.9, 1.6, 1, 2.4);
  // Mossy stones where the stream comes down off the hill.
  add("rock-shelter", 2.7, -1.4, 0.95, 3.6, "sheet");
  add("rock", 0.35, -1.2, 0.8, 1.6, "cushion");
  add("rock", 2.0, -0.4, 0.6, 1);
  add("fern-moss", -0.1, -1.0, 0.8);
  add("grass", 2.2, 0.6, 0.9);
  add("grass", 0.6, -1.3, 0.8);
  // Ferns, bromeliads and a calathea on the far side of the pool.
  add("fern", 2.9, 0.9, 1.1, 2.2);
  add("bromeliad", 3.4, -0.3, 0.85, 1.2);
  add("calathea", 2.4, 1.5, 0.85, 0.4);
  add("fittonia", 3.0, 1.75, 0.9);
  add("orchid", 3.5, 0.4, 0.8, 1.4);
  add("monstera", 3.4, -1.6, 0.9, 4.2);
  add("sheet-moss", 2.7, 0.2, 1);
  // Low cover along the front glass.
  add("fern-moss", 2.3, 1.85, 1.1);
  add("sheet-moss", -0.8, 1.85, 1);
  add("fittonia", 2.5, 1.95, 0.9);
  add("bromeliad", 3.5, 1.85, 0.8, 2.6);
  add("grass", 1.9, 1.5, 0.8, 1.4);
  // The pool: lilies, java moss, a pair of convict cichlids and two micro
  // crabs on the bottom.
  add("water-lily", 1.25, 0.6, 1, 0.4);
  add("water-lily", 0.35, 1.35, 0.8, 2);
  add("java-moss", 1.3, 1.5, 1);
  for (const [x, z, turn] of [
    [0.4, 0.8, 0.2],
    [0.8, 1.2, 0.1],
    [0.6, 0.6, 3.3],
    [1.0, 1.0, 3.1],
  ])
    add("convict-cichlid", x, z, 0.8, turn);
  add("micro-crab", 0.9, 1.45, 1, 0.6);
  add("micro-crab", 0.2, 1.1, 1, 2.5);
  return objects;
}

/** A Rocky Mountain creek: spruce, columbine and kinnikinnick on the bank,
 * frogs, a lizard and a salamander, and trout and sculpins in the water. */
function alpineCreek(add: Add, objects: HabitatObject[]) {
  // Spruce and granite on the high bank behind the creek.
  add("spruce", -2.5, -1.38, 1.4, 0.3);
  add("spruce", 0.5, -1.4, 1.2, 1.2);
  add("granite", -1.6, -0.35, 1.5, 0.6, "sheet");
  add("slate", -0.6, -1.3, 1);
  add("fern", -2.05, -1.2, 1.1);
  add("moss", -0.9, -1.05, 1.1);
  add("fly-agaric", -2.1, -1.45, 1, 0.4);
  // Wildflowers, a fallen log and the salamander on the broad front bank.
  add("columbine", -3.4, 0.8, 1.1);
  add("columbine", -1.6, 1.3, 0.9, 1);
  add("strawberry", -3.9, 1.4, 0.8, 2);
  add("kinnikinnick", -2.5, 0.6, 1.1, 0.5);
  add("spruce", -4.0, 0.2, 0.8, 2);
  add("snag", -1.4, 0.85, 0.8, 1.2);
  add("log", -2.6, 1.3, 0.8, 0.1, "sheet");
  add("leaf-litter", -2.0, 0.9, 0.9);
  add("tiger-salamander", -2.2, 1.0, 1, 1.4);
  add("bolete", -0.9, 1.45, 1, 1.8);
  for (const [kind, x, z, scale] of [
    ["sheet-moss", -3.3, 1.3, 1.2],
    ["fern-moss", -2.9, 0.5, 1.1],
    ["sheet-moss", -0.6, 0.8, 0.9],
    ["moss", -3.7, 0.25, 1],
  ] as const)
    add(kind, x, z, scale);
  // Boulders and flat stones at the edge of the pool, where the canyon tree
  // frog and the fence lizard sit in the sun.
  add("granite", 0.3, 1.05, 1.1, 2);
  add("rock", 0.9, -1.0, 0.9, 2, "fern");
  add("flagstone", 1.2, 1.1, 1, 2.1);
  add("scree", 0.6, 0.15, 1, 0.8);
  add("branch", -0.2, 0.05, 1, 2.6);
  add("hairgrass", -0.3, 1.5, 0.9);
  add("canyon-tree-frog", 0.75, 1.5, 1.2, 0.4);
  add("fence-lizard", 1.6, 1.3, 1.1, 2.2);
  // Cattails and grass where the far bank stays damp.
  add("cattail", 2.3, -1, 1, 0.4);
  add("cattail", 3.3, -0.1, 0.85, 2);
  add("hairgrass", 2.6, -1.2, 1.1);
  add("rock", 3.2, -1.1, 0.75, 1.2);
  add("spruce", 3.9, -1.4, 1.3, 0.8);
  add("spruce", 2.6, -1.5, 0.9, 2.4);
  add("kinnikinnick", 3.1, -0.85, 1, 1.5);
  add("columbine", 4.1, -0.6, 0.9, 0.3);
  add("pebbles", 3.45, 1.05, 1.2, 0.4);
  add("rock", 1.5, -1.5, 0.6);
  add("cutthroat-trout", 2.0, 0.0, 0.8, 0);
  add("cutthroat-trout", 2.7, 0.4, 0.75, 3);
  add("sculpin", 2.4, -0.1, 1, 3);
  add("sculpin", 1.9, 0.6, 1, 0.5);
  add("dwarf-crayfish", 2.2, 0.9, 1, 1.1);
  add("dwarf-crayfish", 2.6, 0.75, 1, 4);
  return objects;
}

/** A shady Vietnamese limestone grotto for mossy frogs: mossy stone and
 * caves, elephant ears and begonias, and harlequin rasboras in the pool. */
function limestoneGrotto(add: Add, objects: HabitatObject[]) {
  // Two caves against the back wall, where the mossy frogs hide by day.
  add("rock-shelter", -1.6, -1.2, 1.2, 0.3, "cushion");
  add("rock-shelter", 0.9, -1.2, 1.0, 2.2, "sheet");
  add("limestone-pinnacle", -0.3, -1.9, 1, 0.6, "java");
  add("limestone", 2.3, -1.25, 1.2, 1, "cushion");
  add("limestone", -2.4, -2.05, 1, 2.5, "sheet");
  add("alocasia", -2.3, -1.0, 1.1, 0.5);
  add("alocasia", 2.5, -0.8, 0.8, 2.4);
  add("mossy-frog", -1.5, -0.8, 1, 0.6);
  add("mossy-frog", 0.8, -0.9, 1, 2.1);
  add("mossy-frog", -0.3, -1.2, 1, 4);
  // Begonias, ferns and mossy stones across the middle.
  add("limestone", 0.4, 0.2, 0.9, 0.7, "fern");
  add("wood", -0.6, -0.4, 0.9, 2.1, "java");
  add("begonia", -2.4, -0.2, 1, 0.3);
  add("begonia", 1.5, -0.2, 0.9, 1.6);
  add("begonia", -0.5, 0.0, 0.8, 2.8);
  add("nest-fern", 2.35, 0.5, 0.9, 1);
  add("fern", 1.4, 1.3, 0.8, 2);
  add("cryptocoryne", 2.0, 1.8, 1, 2.6);
  add("rock", 0.9, 2.0, 0.6, 1.9, "java");
  add("bonnet-mushrooms", -2.6, 0.5, 1, 1.1);
  add("bonnet-mushrooms", 2.6, 1.4, 0.85, 2.7);
  for (const [kind, x, z, scale] of [
    ["sheet-moss", -2.0, -0.4, 1.2],
    ["fern-moss", 1.2, 0.6, 1.1],
    ["sheet-moss", 0.1, -0.7, 1],
    ["moss", 2.0, -1.1, 1.1],
    ["fern-moss", 0.3, 1.6, 0.9],
    ["sheet-moss", 2.5, 2.1, 1],
  ] as const)
    add(kind, x, z, scale);
  // The pool, with java fern on a stone and a school of harlequin rasboras.
  add("rock", -0.6, 1.15, 0.7, 0.2, "java");
  add("java-fern", -2, 1.15, 1, 1.2);
  add("cryptocoryne", -0.75, 1.85, 0.9, 2);
  add("water-lily", -1.7, 1.8, 0.9, 1);
  for (let i = 0; i < 8; i++)
    add(
      "harlequin-rasbora",
      -1.7 + (i % 4) * 0.18,
      1.0 + Math.floor(i / 4) * 0.3,
      1,
      0,
    );
  return objects;
}

/** A Mojave desert spring in the biggest tank: a sandstone mesa and a low
 * ridge along the back, open dunes in front, and a spring in the middle with
 * pupfish, cattails and canyon tree frogs. Lizards, two tortoises, a scorpion
 * and a tarantula live on the dry ground around it. */
function desertSpring(add: Add, objects: HabitatObject[]) {
  // The mesa, with a cave at its foot.
  add("sandstone", -5.3, -2.9, 1.8, 0.4);
  add("sandstone", -3.7, -2.8, 1.4, 1.9);
  add("sandstone-pillar", -4.5, -3.0, 1.3, 0.8);
  add("sandstone-ledge", -2.5, -2.2, 1.2, 2.1);
  add("sandstone-ledge", -5.7, -1.4, 1, 0.3);
  add("rock-shelter", -3.5, -1.2, 1.2, 1.4);
  add("dead-tree", -4.7, -2.0, 1.2, 0.9);
  add("agave", -2.9, -3.1, 1.1, 0.6);
  add("hedgehog-cactus", -5.7, -2.3, 1, 0.5);
  add("hedgehog-cactus", -4.0, -1.9, 0.9, 2);
  add("bunchgrass", -5.0, -1.1, 1);
  add("bunchgrass", -3.2, -2.1, 0.9, 1.4);
  add("desert-spiny-lizard", -2.6, -1.3, 1, 2.6);
  add("desert-tarantula", -2.3, -0.7, 1, 0.7);
  // A prickly pear thicket and barrel cacti between the mesa and the ridge.
  add("prickly-pear", 0.2, -2.6, 1.3, 0.3);
  add("prickly-pear", 0.9, -3.0, 0.9, 1.6);
  add("prickly-pear", -0.6, -3.0, 0.8, 2.6);
  add("barrel-cactus", 1.9, -2.6, 1.2, 0.2);
  add("barrel-cactus", 2.4, -2.0, 0.75, 1);
  add("bunchgrass", -1.2, -2.0, 0.9, 2.5);
  add("branch", 2.9, -1.4, 1.2, 0.9);
  // The ridge, with a second cave and an agave stand.
  add("sandstone", 4.8, -2.8, 1.5, 1.2);
  add("rock-shelter", 3.6, -2.6, 1, 3.4);
  add("sandstone-pillar", 5.8, -2.2, 0.9, 2.8);
  add("agave", 5.5, -1.0, 1.2, 2.2);
  add("agave", 4.1, -1.6, 0.8, 1);
  add("bunchgrass", 3.0, -3.0, 1);
  add("bunchgrass", 6.0, -3.0, 0.9);
  add("fence-lizard", 4.3, -0.6, 1, 2);
  add("stripe-tailed-scorpion", 3.9, -1.2, 1, 2.4);
  // Rushes and grass where the spring keeps the ground damp, and flat stones
  // at the water's edge for the frogs.
  add("cattail", -0.1, 0.0, 1.1, 0.4);
  add("cattail", 0.4, -0.5, 0.9, 2);
  add("cattail", 3.6, 1.4, 1, 1.2);
  add("grass", -0.3, 0.9, 0.9, 0.6);
  add("grass", 2.7, -0.4, 0.8, 2);
  add("grass", 3.5, 0.3, 0.9, 1.1);
  add("grass", 1.1, 2.0, 0.8, 2.8);
  add("flagstone", 2.9, 1.8, 1, 1.3);
  add("flagstone", -0.3, 1.6, 0.8, 0.4);
  add("rock", 3.4, 0.9, 0.7, 2);
  add("canyon-tree-frog", 2.9, 1.7, 1, 2);
  add("canyon-tree-frog", -0.2, 1.5, 1, 0.5);
  for (const [x, z, turn] of [
    [1.2, 0.5, 1],
    [1.5, 0.9, 2.2],
    [1.9, 0.4, 4],
    [2.1, 0.9, 0.3],
    [1.3, 1.1, 3.1],
    [1.8, 0.7, 5.2],
  ])
    add("pupfish", x, z, 1, turn);
  add("leopard-lizard", -1.4, -0.4, 1, 0.8);
  // Open dunes along the front, where the tortoises graze.
  add("barrel-cactus", -4.2, 1.8, 1.1, 0.3);
  add("barrel-cactus", -3.7, 2.4, 0.75, 1.7);
  add("barrel-cactus", -4.8, 2.5, 0.85, 2.9);
  add("prickly-pear", -2.6, 0.2, 1, 1.8);
  add("hedgehog-cactus", -2.0, 1.3, 1, 1);
  add("hedgehog-cactus", -5.8, 2.9, 0.9, 2.3);
  add("bunchgrass", -5.6, 0.6, 1);
  add("bunchgrass", -2.4, 2.8, 0.9, 1.4);
  add("bunchgrass", -1.2, 0.4, 1, 0.4);
  add("sandstone-ledge", -1.0, 2.7, 0.9, 0.3);
  add("pebbles", -1.6, 2.0, 1.2, 0.4);
  add("hedgehog-cactus", 0.2, 2.9, 0.9, 0.6);
  add("bunchgrass", 0.9, 3.1, 0.8, 2.2);
  add("barrel-cactus", 2.2, 3.0, 0.7, 0.9);
  add("desert-tortoise", -3.0, 1.5, 1, 2.2);
  add("desert-tortoise", -5.0, 0.0, 0.9, 0.6);
  // Sun-baked rocks in the front corner for a pair of chuckwallas, which live
  // in small colonies.
  add("sandstone", 5.3, 2.2, 1.2, 0.5);
  add("sandstone-ledge", 4.4, 2.8, 1, 1.9);
  add("chuckwalla", 4.2, 1.7, 1, 3.6);
  add("chuckwalla", 4.6, 2.5, 0.95, 3.2);
  add("hedgehog-cactus", 6.0, 0.8, 1, 0.8);
  add("hedgehog-cactus", 3.9, 3.0, 0.8, 2);
  add("barrel-cactus", 6.0, 3.0, 0.9, 1.2);
  add("bunchgrass", 4.6, 0.6, 1, 2.1);
  add("dead-tree", 6.0, 1.7, 0.8, 2.4);
  add("pebbles", 3.8, 2.2, 1, 1.1);
  return objects;
}

/** Shapes a preset with the same brush players use. Each stroke drags the
 * brush along a path, dabbing as closely as the editor does. */
function sculpt(
  env: Environment,
  strokes: [TerrainMode, number, [number, number][], number?][],
) {
  for (const [mode, radius, path, times = 1] of strokes)
    for (let i = 0; i < times; i++) {
      env = applyTerrainBrush(env, path[0][0], path[0][1], { mode, radius });
      for (let p = 1; p < path.length; p++) {
        const [x0, z0] = path[p - 1],
          [x1, z1] = path[p];
        const dabs = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (radius * 0.22));
        for (let d = 1; d <= dabs; d++)
          env = applyTerrainBrush(
            env,
            x0 + ((x1 - x0) * d) / dabs,
            z0 + ((z1 - z0) * d) / dabs,
            { mode, radius },
          );
      }
    }
  // Centimetre steps are invisible and keep preset share links short.
  const heights = env.terrain!.heights.map(
    (h) => Math.round(h * 100) / 100 || 0,
  );
  return { ...env, terrain: { ...env.terrain!, heights } };
}

/** Flattens the default bank so a preset can shape its own landscape on top,
 * with water close below the ground instead of in a low corner. */
function level(env: Environment, ground: number): Environment {
  return {
    ...env,
    terrain: newTerrain(env, (x, z) => ground - baseGroundHeight(x, z, env)),
  };
}

/** Substrate sloping up toward the back glass, as aquascapers lay it. */
function aquascape() {
  const env = { ...defaultEnvironment, water: AQUARIUM_WATER };
  return sculpt(level(env, 0.35), [
    [
      "raise",
      1.6,
      [
        [-3.5, -2.2],
        [3.5, -2.2],
      ],
    ],
  ]);
}

/** A wide tank with a hill along the back and a stream running down into a
 * deep pool at the front. */
function forestFloor() {
  const stream: [number, number][] = [
    [1.6, -2.2],
    [1.4, -1.2],
    [0.9, -0.3],
    [0.8, 0.5],
  ];
  return sculpt(
    level({ ...defaultEnvironment, width: 8, height: 4, water: 0.6 }, 0.9),
    [
      ["raise", 1.8, [[-2.4, -1.7]], 2],
      ["raise", 1.5, [[2.6, -1.6]], 3],
      ["raise", 1.6, [[3.0, 1.2]], 2],
      ["pool", 0.6, stream],
      ["smooth", 0.9, stream, 2],
      ["pool", 1.9, [[0.7, 0.9]]],
      ["lower", 1.4, [[0.7, 1.0]], 5],
    ],
  );
}

/** A small, deep tank with a stone wall across the back and a dark pool in
 * the front corner. */
function grottoFloor() {
  const env: Environment = {
    ...defaultEnvironment,
    width: 6,
    depth: 5,
    water: 0.45,
    warmth: 0.6,
    brightness: 0.85,
  };
  return sculpt(level(env, 0.75), [
    [
      "raise",
      1.7,
      [
        [-3, -2.6],
        [3, -2.6],
      ],
      3,
    ],
    [
      "stone",
      0.9,
      [
        [-3, -2.3],
        [3, -2.3],
      ],
    ],
    ["raise", 1.6, [[2, 0.3]], 2],
    ["pool", 1.9, [[-1.3, 1.3]]],
    ["lower", 1.5, [[-1.3, 1.4]], 6],
  ]);
}

/** A long, shallow tank with a creek winding across it into a pool for the
 * trout, below a ridge along the back. */
function creekBed() {
  const creek: [number, number][] = [
    [-4.5, -0.9],
    [-3.2, -0.5],
    [-1.8, -0.2],
    [-0.2, -0.1],
    [1.2, 0.1],
    [2.3, 0.4],
    [3.4, 0.9],
    [4.5, 1.3],
  ];
  const env: Environment = {
    ...defaultEnvironment,
    width: 9,
    depth: 4.2,
    water: 0.55,
    light: "golden",
    warmth: 0.3,
  };
  return sculpt(level(env, 0.85), [
    [
      "raise",
      1,
      [
        [-4.5, -2.2],
        [0.5, -2.2],
      ],
      2,
    ],
    ["raise", 1.6, [[3.7, -1.4]], 2],
    ["pool", 0.6, creek],
    ["smooth", 0.9, creek, 2],
    ["lower", 0.5, creek],
    ["pool", 1.3, [[2.3, 0.3]]],
    ["lower", 1.1, [[2.3, 0.3]], 5],
  ]);
}

/** A wide, low, bright tank of rolling sand that rises into a mesa at the
 * back and dips in the middle to hold a spring. */
function desertBasin() {
  const env: Environment = {
    ...defaultEnvironment,
    width: 13,
    depth: 7,
    height: 2.4,
    water: 0.3,
    warmth: 0.8,
    brightness: 1.25,
  };
  const bump = (distance: number) => {
    const t = Math.min(1, Math.max(0, (1.2 - distance) / 0.8));
    return t * t * (3 - 2 * t);
  };
  const terrain = newTerrain(
    env,
    (x, z) => {
      const dunes =
        0.72 +
        0.07 * Math.sin(x * 0.9 + z * 0.6) +
        0.04 * Math.sin(x * 2.1 - z * 1.3);
      const mesa = 0.8 * bump(Math.hypot((x + 4.6) / 2.4, (z + 2.7) / 1.3));
      const ridge = 0.35 * bump(Math.hypot((x - 4.6) / 2.2, (z + 2.8) / 1.1));
      const spring = bump(Math.hypot((x - 1.6) / 2.6, (z - 0.7) / 1.8) + 0.2);
      const height = dunes + mesa + ridge - 0.85 * spring;
      // Centimetre steps, like sculpted presets, keep share links short.
      return Math.max(
        -0.9,
        Math.round((height - baseGroundHeight(x, z, env)) * 100) / 100,
      );
    },
    "sand",
  );
  return { ...env, terrain };
}
