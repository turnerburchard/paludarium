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
import { prebuiltObjects, rockShelter } from "./prebuilts";
import { randomFromSeed } from "./random";
import { objectBase } from "./stacking";
import { baseGroundHeight, groundHeight } from "./terrain";
import { applyTerrainBrush, type TerrainMode } from "./terrainBrush";
import { newTerrain } from "./terrainData";
export type Preset =
  | "empty"
  | "tropical"
  | "mountain"
  | "desert"
  | "grotto"
  | "island"
  | "aquarium";
type Add = (
  kind: AssetKind,
  x: number,
  z: number,
  scale?: number,
  rotation?: number,
  moss?: MossSpecies,
) => void;
/** Adds a rock shelter's stones, with any moss on its capstone. */
type Shelter = (
  x: number,
  z: number,
  rotation?: number,
  moss?: MossSpecies,
) => void;
/** Rests the last object added on the one added before it, `height` above
 * that one's base. */
type Stack = (height: number) => void;
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
  const shelters =
    (env: Environment): Shelter =>
    (x, z, rotation = 0, moss) => {
      const pieces = prebuiltObjects(
        rockShelter,
        x,
        z,
        rotation,
        env,
        // One serial per shelter, as for any other object, so adding one
        // leaves the seeds of everything after it unchanged.
        randomFromSeed(++serial * 173),
      );
      if (moss) pieces[pieces.length - 1].moss = moss;
      objects.push(...pieces);
    };
  const stacks =
    (env: Environment): Stack =>
    (height) => {
      const [support, piece] = objects.slice(-2);
      piece.support = support.id;
      piece.lift =
        objectBase(support, env) + height - groundHeight(piece.x, piece.z, env);
    };
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
  if (preset === "island")
    return {
      version: 1,
      name: "Tropical island",
      environment: islandLagoon(),
      objects: tropicalIsland(add, objects),
    };
  if (preset === "tropical") {
    const environment = forestFloor();
    return {
      version: 1,
      name: "Cloud forest",
      environment,
      objects: cloudForest(add, shelters(environment), objects),
    };
  }
  if (preset === "mountain")
    return {
      version: 1,
      name: "Alpine creek",
      environment: creekBed(),
      objects: alpineCreek(add, objects),
    };
  if (preset === "grotto") {
    const environment = grottoFloor();
    return {
      version: 1,
      name: "Limestone grotto",
      environment,
      objects: limestoneGrotto(
        add,
        shelters(environment),
        stacks(environment),
        objects,
      ),
    };
  }
  const environment = desertBasin();
  return {
    version: 1,
    name: "Desert spring",
    environment,
    objects: desertSpring(add, shelters(environment), objects),
  };
}

/** Costa Rican cloud forest: broad leaves, orchids and poison frogs above a
 * pond of convict cichlids. */
function cloudForest(add: Add, shelter: Shelter, objects: HabitatObject[]) {
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
  shelter(2.7, -1.4, 3.6, "sheet");
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

/** A planted island in a deep lagoon, as hobbyists build a paludarium:
 * mantellas and day geckos on land, vampire crabs on the shore, and tetras,
 * gouramis, shrimp and micro crabs in the water. */
function tropicalIsland(add: Add, objects: HabitatObject[]) {
  // Big leaves on the high ground, for the geckos to climb.
  add("monstera", -1.75, -1.25, 1.45, 5.2);
  add("swiss-cheese-plant", -0.65, -0.95, 1.3, 0.8);
  add("alocasia", 0.35, -1.35, 1.15, 2);
  add("peace-lily", -0.05, -0.55, 0.8, 2.9);
  add("tree-roots", -2.45, -0.75, 1, 1.6);
  add("wood", 0.75, -1.55, 1, 4.2);
  for (const [kind, x, z, scale, rotation] of [
    ["fern", -2.25, -1.65, 0.75, 0.4],
    ["fern", -1.65, -0.45, 1.1, 2.2],
    ["fern", -0.55, -0.15, 0.75, 4.1],
    ["fittonia", -1.2, -0.85, 1, 1.1],
    ["fittonia", -2.0, -0.95, 1, 3.4],
    ["moss", -1.0, -0.35, 1, 0.3],
    ["moss", -0.25, -0.2, 1, 2.6],
    ["moss", 0.45, -0.75, 1, 4.4],
    ["moss", -1.4, -0.25, 0.9, 1.7],
  ] as const)
    add(kind, x, z, scale, rotation);
  // Sedge, river stones and epiphytes where the island meets the water.
  for (const [kind, x, z, scale, rotation] of [
    ["grass", -2.6, -1.45, 1, 0.5],
    ["grass", -2.35, -0.6, 0.9, 2.1],
    ["grass", 0.7, -1.2, 0.9, 3.7],
    ["rock", 1.15, -0.55, 0.7, 1.3],
    ["pebbles", 0.6, -0.1, 1, 0.8],
    ["anubias", -2.75, -0.5, 1, 0.6],
    ["anubias", 1.35, -1.6, 1, 4.5],
    ["java-fern", -2.45, 0.1, 1, 2.8],
  ] as const)
    add(kind, x, z, scale, rotation);
  // Tall vallisneria in the open water, swords and rotala in front.
  for (const [kind, x, z, scale, rotation] of [
    ["vallisneria", 2.55, -1.2, 1, 0],
    ["vallisneria", 2.95, -0.55, 1.1, 1.4],
    ["vallisneria", 2.1, -1.75, 0.9, 2.9],
    ["amazon-sword", -1.1, 1.05, 1, 0.9],
    ["amazon-sword", -0.3, 1.35, 0.9, 3.3],
    ["rotala", -2.75, 1.75, 1, 1.9],
    ["java-fern", -1.6, 1.8, 1, 5.1],
  ] as const)
    add(kind, x, z, scale, rotation);
  for (const [x, z, heading] of [
    [-1.4, -0.65, 0.4],
    [-0.9, -0.6, 2.1],
    [-1.2, -1.1, 4.6],
  ])
    add("golden-mantella", x, z, 1, heading);
  add("gecko", -1.95, -1.25, 1, 1.2);
  add("gecko", 0.15, -1.1, 1, 3.9);
  add("vampire-crab", 0.95, -0.85, 1, 2.4);
  add("vampire-crab", -2.6, -1.0, 1, 5.6);
  for (let i = 0; i < 6; i++)
    add(
      "cardinal-tetra",
      0.2 + (i % 3) * 0.3,
      0.5 + Math.floor(i / 3) * 0.3,
      1,
      0.4,
    );
  add("pearl-gourami", 2.0, -0.2, 1, 3.6);
  add("pearl-gourami", 1.6, 0.5, 1, 2.2);
  for (const [kind, x, z, heading] of [
    ["cherry-shrimp", -1.15, 0.8, 1.1],
    ["cherry-shrimp", -0.7, 1.4, 4.3],
    ["micro-crab", -1.6, 1.15, 0.6],
    ["micro-crab", -1.3, 1.55, 2.9],
    ["micro-crab", -0.75, 1.75, 5.0],
  ] as const)
    add(kind, x, z, 1, heading);
  return objects;
}

/** A Rocky Mountain creek running down a stony slope, past a granite knoll
 * and a wildflower meadow, into a trout pool. */
function alpineCreek(add: Add, objects: HabitatObject[]) {
  // Broken stone up the slope behind the creek, with spruce seedlings
  // coming up between the rocks.
  add("flagstone", 3.0, -1.5, 1.2, 0.9);
  add("granite", 3.45, -1.2, 0.9, 1.9, "sheet");
  add("granite", -1.6, -1.5, 1.1, 0.4, "cushion");
  add("spruce", 2.2, -1.35, 1, 1.2);
  add("spruce", -2.15, -1.5, 0.9, 2.4);
  add("snag", -2.7, -1.3, 1, 1.2);
  add("stump", 3.6, -0.95, 0.8, 0.4, "sheet");
  for (const [kind, x, z, scale] of [
    ["kinnikinnick", 1.95, -1.45, 1.1],
    ["kinnikinnick", 2.95, -0.45, 1],
    ["kinnikinnick", 4.1, -0.2, 1.1],
    ["kinnikinnick", -3.2, -1.6, 1.1],
    ["kinnikinnick", -1.1, -1.5, 1],
    ["kinnikinnick", 3.3, -1.75, 1],
    ["fly-agaric", 2.5, -1.25, 0.75],
    ["fly-agaric", 2.66, -1.14, 0.6],
    ["bolete", -1.35, -1.15, 1],
    ["fern", -1.5, -0.75, 0.65],
    ["fern", -0.75, -0.85, 0.75],
    ["fern", 2.0, -0.45, 0.6],
    ["fern", 3.3, -0.3, 0.7],
    ["columbine", 3.65, -0.55, 0.9],
    ["columbine", 4.2, -0.75, 1],
  ] as const)
    add(kind, x, z, scale, x * 1.7);
  // A granite knoll where the fence lizard suns itself.
  add("granite", 0.3, -1.45, 1.3, 0.6, "cushion");
  add("scree", 1.0, -1.25, 1.1, 2);
  add("granite", -0.25, -1.15, 0.9, 2.4);
  add("scree", 0.8, -0.8, 1, 0.8);
  add("fence-lizard", 0.6, -1.0, 1.1, 2.2);
  // Boulders, river stones and gravel along the creek, with sedge and
  // hairgrass on the damp banks.
  add("granite", -2.9, -0.7, 1, 1.3);
  add("rock", -1.0, 0.35, 0.7, 2, "fern");
  add("rock", 0.15, -0.25, 0.6, 0.5);
  add("granite", 2.4, 1.3, 0.9, 0.2);
  add("scree", -4.0, -1.3, 1, 1.6);
  for (const [x, z, scale] of [
    [-2.0, 0.15, 1.2],
    [0.0, 0.55, 1.1],
    [3.05, 1.7, 1.1],
  ])
    add("pebbles", x, z, scale, x);
  add("flagstone", 0.7, 1.4, 1.1, 2.1);
  add("flagstone", 2.3, -0.15, 0.9, 0.7);
  for (const [kind, x, z, scale] of [
    ["grass", -2.35, -0.85, 1],
    ["grass", -0.8, -0.5, 0.9],
    ["grass", 2.9, 0.45, 1],
    ["grass", 3.95, 1.05, 0.9],
    ["hairgrass", -3.4, 0.55, 1.1],
    ["hairgrass", -1.9, 0.6, 1],
    ["hairgrass", -0.6, 0.8, 0.9],
    ["hairgrass", 0.45, 1.05, 1],
    ["cattail", 2.45, 0.15, 1],
    ["cattail", 2.7, 0.35, 0.85],
    ["cattail", 2.3, -0.05, 0.9],
  ] as const)
    add(kind, x, z, scale, x * 2.3);
  // A wildflower meadow on the front bank, with a fallen log for the
  // salamander.
  for (const [kind, x, z, scale] of [
    ["columbine", -3.7, 1.0, 1.1],
    ["columbine", -3.3, 1.35, 0.9],
    ["columbine", -2.9, 1.7, 1],
    ["columbine", -2.6, 0.95, 1],
    ["columbine", -1.2, 1.5, 0.9],
    ["columbine", -0.8, 1.25, 1],
    ["strawberry", -4.1, 1.2, 1],
    ["strawberry", -1.6, 1.75, 0.9],
    ["kinnikinnick", -3.9, 1.65, 1],
    ["kinnikinnick", -0.95, 1.75, 0.9],
    ["spruce", -4.1, 0.2, 0.75],
  ] as const)
    add(kind, x, z, scale, x * 1.3);
  add("log", -2.2, 1.35, 1, 0.3, "sheet");
  add("tiger-salamander", -2.0, 1.0, 1, 1.4);
  // The pool: trout in open water, sculpins and crayfish on the stones, and
  // the canyon tree frog on a flat stone at the edge.
  add("canyon-tree-frog", 0.7, 1.4, 1.2, 0.4);
  add("cutthroat-trout", 1.3, 0.4, 0.8, 0);
  add("cutthroat-trout", 1.8, 0.75, 0.75, 3);
  add("sculpin", 1.2, 0.75, 1, 3);
  add("sculpin", 1.9, 0.3, 1, 0.5);
  add("dwarf-crayfish", 1.5, 0.95, 1, 1.1);
  add("dwarf-crayfish", 1.1, 0.25, 1, 4);
  return objects;
}

/** A shady Vietnamese limestone grotto for mossy frogs: a mossy karst wall
 * with caves at its foot, a seep trickling down past begonias and elephant
 * ears, and a dark pool of harlequin rasboras in the front corner. */
function limestoneGrotto(
  add: Add,
  shelter: Shelter,
  stack: Stack,
  objects: HabitatObject[],
) {
  // Karst stone climbing the wall in broken tiers: pinnacles and stacked
  // outcrops along the top, smaller stones partway up, and loose cobbles
  // near the foot, furred with moss and leaving room for the seep's gully.
  add("limestone-pinnacle", -2.45, -2.05, 1.35, 0.6, "cushion");
  add("limestone", -1.35, -2.1, 1, 1);
  add("limestone-pinnacle", -1.3, -2.25, 0.7, 2.6, "sheet");
  stack(0.7);
  add("limestone-pinnacle", 0.3, -2.1, 1.2, 2.2, "java");
  add("limestone", 2.45, -2.05, 1.1, 0.3, "sheet");
  add("limestone", 2.5, -2.15, 0.6, 3.4, "cushion");
  stack(0.8);
  add("limestone", -1.95, -1.65, 0.75, 4.2, "fern");
  add("rock", -0.4, -1.75, 0.55, 2.4, "sheet");
  add("limestone-pinnacle", 0.75, -1.8, 0.8, 1.2, "cushion");
  add("limestone", 2.05, -1.6, 0.65, 5.1, "fern");
  add("slate", -2.65, -1.4, 0.55, 0.9);
  add("cobble", -2.6, -1.4, 0.9, 2);
  stack(0.12);
  add("cobble", -0.95, -1.4, 1, 0.7);
  add("cobble", 2.8, -1.3, 0.9, 3.3);
  add("tree-roots", 0.35, -1.05, 1, -0.2);
  add("orchid", -0.75, -1.9, 0.8, 0.9);
  add("orchid", 2.85, -1.7, 0.75, 2.4);
  add("nest-fern", -0.2, -1.95, 0.8, 1.3);
  add("nest-fern", 1.75, -2.05, 0.7, 4);
  for (const [kind, x, z, scale] of [
    ["sheet-moss", -2.0, -2.1, 1],
    ["fern-moss", 1.0, -2.2, 0.9],
    ["moss", -0.3, -1.45, 0.8],
  ] as const)
    add(kind, x, z, scale);
  // Two caves at the foot of the wall, where the mossy frogs rest by day,
  // with elephant ears and begonias crowding the entrances.
  shelter(-1.85, -1.0, 0.3, "cushion");
  shelter(2.25, -0.75, 2.6, "sheet");
  add("mossy-frog", -1.7, -0.6, 1, 0.6);
  add("mossy-frog", 2.0, -0.35, 1, 2.4);
  add("mossy-frog", 0.95, -1.05, 1, 4);
  add("alocasia", -2.5, -0.85, 1.15, 0.5);
  add("alocasia", 2.55, -0.15, 0.95, 2.4);
  add("alocasia", -0.6, -1.3, 0.8, 1.6);
  add("begonia", -2.65, -0.15, 1, 0.3);
  add("begonia", -1.05, -0.85, 0.9, 2.8);
  add("begonia", 1.5, -0.6, 0.95, 1.6);
  add("begonia", 2.75, 0.55, 0.85, 4.4);
  add("fern", -2.2, 0.45, 0.85, 1.1);
  add("fern", 2.2, 1.05, 0.8, 2);
  // Mossy stones and java fern where the seep comes down off the wall.
  add("rock", 1.25, -1.45, 0.6, 0.8, "java");
  add("limestone", 0.55, -0.35, 0.7, 2.1, "cushion");
  add("java-fern", 0.95, -0.55, 0.9, 1.2);
  add("cryptocoryne", 0.05, -0.05, 0.9, 0.4);
  add("cryptocoryne", -0.55, 0.65, 0.85, 2.6);
  add("wood", -0.25, -0.75, 0.8, 2.1, "java");
  for (const [kind, x, z, scale] of [
    ["sheet-moss", -1.4, 0.0, 1.2],
    ["fern-moss", 1.15, 0.2, 1.1],
    ["moss", 1.75, 0.6, 1],
    ["sheet-moss", -2.5, 0.95, 1],
    ["fern-moss", 0.75, 1.3, 1],
    ["moss", 2.6, 1.6, 1.1],
  ] as const)
    add(kind, x, z, scale);
  // Leaf litter and fungus on the damp bank in front.
  add("fungus-log", 1.55, 1.35, 0.9, 0.3);
  add("leaf-litter", 0.25, 1.85, 1);
  add("leaf-litter", 2.3, 2.0, 0.9);
  add("bonnet-mushrooms", 1.85, 1.75, 0.9, 1.1);
  add("bonnet-mushrooms", -2.4, -0.45, 0.85, 2.7);
  add("begonia", 0.95, 2.05, 0.8, 0.9);
  add("nest-fern", 2.45, 1.95, 0.8, 0.2);
  // The pool, with crypts and java fern along its edge and a school of
  // harlequin rasboras in the open water.
  add("limestone", -0.3, 1.55, 0.6, 0.9, "java");
  add("java-fern", -2.6, 1.45, 1, 1.2);
  add("cryptocoryne", -0.45, 2.15, 0.9, 2);
  add("cryptocoryne", -2.7, 2.1, 0.85, 3.1);
  add("java-moss", -1.0, 1.0, 1);
  add("water-lily", -1.9, 2.0, 0.9, 1);
  for (let i = 0; i < 8; i++)
    add(
      "harlequin-rasbora",
      -1.8 + (i % 4) * 0.18,
      1.25 + Math.floor(i / 4) * 0.3,
      1,
      0,
    );
  // Added after the rest so their seeds leave everything above unchanged.
  add("limestone-pinnacle", -1.55, -1.5, 1);
  add("capstone", -1.85, -2.0, 1);
  add("fittonia", -0.8, -2.15, 1);
  return objects;
}

/** A Mojave desert spring in the biggest tank: a sandstone mesa and a low
 * ridge along the back, open dunes in front, and a spring in the middle with
 * pupfish, cattails and canyon tree frogs. Lizards, two tortoises, a scorpion
 * and a tarantula live on the dry ground around it. */
function desertSpring(add: Add, shelter: Shelter, objects: HabitatObject[]) {
  // The mesa, with a cave at its foot.
  add("sandstone", -5.3, -2.9, 1.8, 0.4);
  add("sandstone", -3.7, -2.8, 1.4, 1.9);
  add("sandstone-pillar", -4.5, -3.0, 1.3, 0.8);
  add("sandstone-ledge", -2.5, -2.2, 1.2, 2.1);
  add("sandstone-ledge", -5.7, -1.4, 1, 0.3);
  shelter(-3.5, -1.2, 1.4);
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
  shelter(3.6, -2.6, 3.4);
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

/** A small, deep tank with a karst wall across the back, a seep running
 * down from a notch in it, and a dark pool in the front corner. */
function grottoFloor() {
  const seep: [number, number][] = [
    [1.45, -2.5],
    [1.3, -1.6],
    [0.8, -0.9],
    [0.3, -0.2],
    [-0.4, 0.5],
    [-1.3, 1.3],
  ];
  const pool = { x: -1.6, z: 1.55 };
  const env: Environment = {
    ...defaultEnvironment,
    width: 6,
    depth: 5,
    water: 0.5,
    warmth: 0.6,
    brightness: 0.85,
  };
  const smooth = (t: number) => {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  };
  const terrain = newTerrain(env, (x, z) => {
    // The wall rises steeply behind a band of bank, its top uneven and
    // its foot pushed forward on the left.
    const foot = -1.1 + 0.25 * smooth((-x - 0.5) / 2);
    const wall =
      (1.0 + 0.12 * Math.sin(x * 2.3) + 0.06 * Math.sin(x * 5.1 + 1)) *
      smooth((foot - z) / 1.3);
    const terrace = 0.15 * smooth(1 - Math.hypot(x - 2.2, z - 0.4) / 1.3);
    const ground = 0.82 + 0.05 * Math.sin(x * 1.7 - z * 1.3) + wall + terrace;
    // The seep cuts a gully down the wall, then runs as a shallow stream
    // across the bank.
    const channel = 1 - smooth((distanceToPath(x, z, seep) - 0.15) / 0.3);
    const stream = smooth((z - foot) / 0.4);
    const bed = ground + (env.water - 0.2 - ground) * stream;
    const basin = 1 - smooth((Math.hypot(x - pool.x, z - pool.z) - 0.85) / 0.6);
    const height = Math.min(
      ground + (Math.min(bed, ground - 0.2) - ground) * channel,
      ground + (env.water - 0.45 - ground) * basin,
    );
    return Math.round((height - baseGroundHeight(x, z, env)) * 100) / 100;
  });
  // Bare stone up the wall and along the seep, moss on the ledges and
  // carpeting the bank.
  return sculpt({ ...env, terrain }, [
    [
      "moss",
      1.3,
      [
        [-2.4, 0.3],
        [0.6, 0.5],
        [2.4, 1.2],
      ],
    ],
    [
      "moss",
      0.9,
      [
        [0.4, 1.9],
        [2.6, 2.0],
      ],
    ],
    [
      "moss",
      0.9,
      [
        [-2.6, -0.9],
        [2.6, -0.6],
      ],
    ],
    [
      "stone",
      0.7,
      [
        [-3, -1.75],
        [3, -1.6],
      ],
    ],
    [
      "moss",
      0.5,
      [
        [-2.8, -2.25],
        [0.6, -2.3],
      ],
    ],
    [
      "moss",
      0.55,
      [
        [2.0, -1.35],
        [2.9, -1.1],
      ],
    ],
    ["moss", 0.5, [[-0.2, -1.5]]],
    ["stone", 0.45, seep],
    ["stone", 1.1, [[pool.x, pool.z]]],
  ]);
}

/** A long tank where a creek cuts diagonally from a stony slope at the back
 * to a meadow at the front, widening into a pool for the trout. */
function creekBed() {
  const creek: [number, number][] = [
    [-4.7, -1.6],
    [-3.6, -1.05],
    [-2.6, -0.4],
    [-1.5, -0.05],
    [-0.4, 0.15],
    [0.6, 0.35],
    [1.5, 0.6],
    [2.5, 0.95],
    [3.4, 1.4],
    [4.7, 1.8],
  ];
  const pool = { x: 1.5, z: 0.55 };
  const env: Environment = {
    ...defaultEnvironment,
    width: 9,
    depth: 4.2,
    water: 0.55,
    light: "golden",
    warmth: 0.3,
  };
  const smooth = (t: number) => {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  };
  const terrain = newTerrain(env, (x, z) => {
    const slope = 0.4 * smooth((-z - 0.3) / 1.6);
    const knoll = 0.12 * smooth(1 - Math.hypot(x - 0.4, z + 1.6) / 1.3);
    const meadow = 0.1 * smooth(1 - Math.hypot(x + 3, z - 1.3) / 1.4);
    const ground = 0.86 + slope + knoll + meadow;
    const channel = 1 - smooth((distanceToPath(x, z, creek) - 0.25) / 0.5);
    const basin = 1 - smooth((Math.hypot(x - pool.x, z - pool.z) - 0.6) / 0.6);
    const height = Math.min(
      ground + (env.water - 0.2 - ground) * channel,
      ground + (env.water - 0.45 - ground) * basin,
    );
    return Math.round((height - baseGroundHeight(x, z, env)) * 100) / 100;
  });
  // A stony bed and banks along the water, a moss meadow in front, and moss
  // in patches up the slope.
  const meadow: [number, number][] = [
    [-4.2, 1.3],
    [-1.8, 1.2],
    [-0.4, 1.4],
    [0.6, 1.9],
    [2.1, 1.95],
  ];
  const creekside: [number, number][] = [
    [-4.2, 0.4],
    [-2.6, 0.5],
    [-1.4, 0.7],
  ];
  const farBank: [number, number][] = [
    [2.0, -0.5],
    [3.4, -0.2],
    [4.3, 0.7],
  ];
  return sculpt({ ...env, terrain }, [
    ["moss", 1.2, meadow],
    ["moss", 0.8, creekside],
    ["moss", 0.7, farBank],
    [
      "moss",
      0.6,
      [
        [-1.2, -1.0],
        [-0.6, -0.7],
      ],
    ],
    [
      "moss",
      0.6,
      [
        [2.6, -1.4],
        [3.9, -1.2],
      ],
    ],
    [
      "moss",
      0.5,
      [
        [-0.6, -1.95],
        [1.1, -1.95],
      ],
    ],
    [
      "moss",
      0.6,
      [
        [-3.9, -1.9],
        [-3.0, -1.8],
      ],
    ],
    ["stone", 0.75, creek],
    ["stone", 1.3, [[pool.x, pool.z]]],
    [
      "stone",
      0.6,
      [
        [0.4, -1.5],
        [0.9, -1.2],
      ],
    ],
  ]);
}

/** A tank of deep water around a raised island toward the back. */
function islandLagoon() {
  const env: Environment = { ...defaultEnvironment, water: 1.3, warmth: 0.6 };
  const smooth = (t: number) => {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  };
  // 1 on a mound's top, sloping away to 0 well past its shore.
  const mound = (x: number, z: number, rx: number, rz: number) =>
    smooth((1.3 - Math.hypot(x / rx, z / rz)) / 0.95);
  const terrain = newTerrain(
    env,
    (x, z) => {
      const floor = 0.14 + 0.04 * Math.sin(x * 1.3 + z * 0.9);
      const island = Math.max(
        mound(x + 0.6, z + 0.8, 2.6, 1.4),
        mound(x + 1.9, z + 1.1, 1.45, 1.1),
      );
      const peak = 0.12 * smooth(1 - Math.hypot(x + 0.9, z + 1.0) / 1.3);
      const height = floor + (1.58 + peak - floor) * island;
      return Math.round((height - baseGroundHeight(x, z, env)) * 100) / 100;
    },
    "sand",
  );
  // Moss over the island, with bare soil around its back edge.
  return sculpt({ ...env, terrain }, [
    [
      "soil",
      0.6,
      [
        [-2.9, -1.4],
        [-1.5, -1.85],
        [0.5, -1.85],
        [1.3, -1.3],
      ],
    ],
    [
      "moss",
      1.0,
      [
        [-2.1, -0.9],
        [-0.9, -0.8],
        [0.4, -0.9],
      ],
    ],
  ]);
}

function distanceToPath(x: number, z: number, path: [number, number][]) {
  let nearest = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [x0, z0] = path[i - 1],
      [x1, z1] = path[i];
    const dx = x1 - x0,
      dz = z1 - z0;
    const t = Math.min(
      1,
      Math.max(0, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)),
    );
    nearest = Math.min(nearest, Math.hypot(x - x0 - t * dx, z - z0 - t * dz));
  }
  return nearest;
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
