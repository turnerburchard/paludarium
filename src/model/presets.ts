import { createObjectId } from "./objectId";
import { WORLD_VERSION } from "./migrations";
import {
  defaultEnvironment,
  AQUARIUM_WATER,
  emptyWorld,
  type AssetKind,
  type Environment,
  type HabitatObject,
  type Spring,
  type World,
} from "./schema";
import type { MossSpecies } from "./moss";
import { prebuiltObjects, rockShelter } from "./prebuilts";
import { randomFromSeed } from "./random";
import { objectBase } from "./stacking";
import { baseGroundHeight, groundHeight } from "./terrain";
import { applyTerrainBrush, type TerrainMode } from "./terrainBrush";
import { newTerrain, terrainPoint, type GroundMaterial } from "./terrainData";
export type Preset =
  | "empty"
  | "tropical"
  | "mountain"
  | "desert"
  | "grotto"
  | "island"
  | "amazon";
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
      // A support sunk into a slope can have its top below the ground here,
      // and saves only accept a piece resting on or above the ground.
      piece.lift = Math.max(
        0,
        objectBase(support, env) + height - groundHeight(piece.x, piece.z, env),
      );
    };
  if (preset === "amazon") {
    // Sunken wood and fallen leaves in place of stone, as in a blackwater
    // creek.
    add("wood", -1.45, -0.35, 1.1, -0.5);
    add("tree-roots", -2.45, -0.95, 1.2, 0.5);
    add("spiderwood", -1.95, 0.85, 0.9, 2);
    add("forked-branch", 0.25, -1.15, 1, 1.4);
    add("wood", 1.65, 0.95, 0.8, 2.7);
    for (const [x, z, rotation] of [
      [2.6, -0.5, 0.6],
      [-1.0, 0.25, 2.1],
      [0.9, 1.55, 4],
      [-2.4, 1.6, 1.2],
      [2.3, -1.6, 5.3],
    ])
      add("leaf-litter", x, z, 1, rotation);
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
    // Each is turned so its long leaves fall along the back glass.
    for (const [x, z, rotation] of [
      [-2.9, -1.8, 4.2],
      [-2.3, -1.85, 0],
      [-0.9, -1.8, 2],
      [-0.3, -1.85, 0],
      [0.9, -1.85, 3.4],
      [1.5, -1.7, 4.9],
      [2.9, -1.75, 5.2],
    ])
      add("vallisneria", x, z, 1 + (x % 0.4), rotation);
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
    // Angelfish in the open water and a group of corydoras along the bottom.
    for (const [x, z, heading] of [
      [-1.0, -0.2, 0.6],
      [-0.8, -0.7, 0.8],
      [-1.5, -0.9, 0.5],
    ])
      add("angelfish", x, z, 1, heading);
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
      version: WORLD_VERSION,
      name: "Amazon river",
      environment: blackwater(),
      objects,
    };
  }
  if (preset === "island")
    return {
      version: WORLD_VERSION,
      name: "Tropical island",
      environment: islandLagoon(),
      objects: tropicalIsland(add, objects),
    };
  if (preset === "tropical") {
    const environment = forestFloor();
    return {
      version: WORLD_VERSION,
      name: "Cloud forest",
      environment,
      objects: cloudForest(
        add,
        shelters(environment),
        stacks(environment),
        objects,
      ),
    };
  }
  if (preset === "mountain")
    return {
      version: WORLD_VERSION,
      name: "Alpine creek",
      environment: creekBed(),
      objects: alpineCreek(add, objects),
    };
  if (preset === "grotto") {
    const environment = grottoFloor();
    return {
      version: WORLD_VERSION,
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
    version: WORLD_VERSION,
    name: "Desert spring",
    environment,
    objects: desertSpring(add, shelters(environment), objects),
  };
}

/** Costa Rican cloud forest on a mossy knoll that reads from every side: a
 * strangler fig on top for the tree frogs, tree ferns down its slopes,
 * poison frogs and glass frogs, springs tumbling to a deep lagoon of convict
 * cichlids, and a pond behind. */
function cloudForest(
  add: Add,
  shelter: Shelter,
  stack: Stack,
  objects: HabitatObject[],
) {
  // The crown of the knoll: a strangler fig with the springs welling up
  // between its roots, and big leaves crowding its base.
  add("strangler-fig", -0.5, -0.3, 1, 0);
  add("monstera", 0.4, 0.15, 0.95, 2.2);
  add("tree-philodendron", -1.4, -1, 1.0, 0.4);
  add("bromeliad", -1.25, 0.1, 0.85, 1.3);
  add("orchid", 0.2, -1.25, 0.8, 2.6);
  add("anthurium", -0.1, 0.7, 0.85, 0.9);
  add("tree-frog", -0.95, 0.35, 1.2, 1.4);
  add("tree-frog", 0.15, -0.7, 1.2, 4.2);
  // Mossy stones where the brook comes off the knoll, and a tree fern over
  // it.
  add("quaternius-outcrop", 0.45, -0.85, 0.8, 1.2, "cushion");
  add("rock", 1.05, -0.65, 0.5, 0.6, "fern");
  add("tree-fern", 1.35, -1.25, 1.0, 0.7);
  add("fern", 0.95, -0.05, 0.85, 3.4);
  add("nest-fern", 0.65, -1.55, 0.8, 0.2);
  // The back slope: a cave where the frogs shelter, with elephant ears and a
  // monstera around it.
  shelter(-0.35, -1.55, 3.3, "sheet");
  add("monstera", 2.05, -1.7, 0.85, 5);
  add("alocasia", -1.4, -1.75, 0.9, 1.9);
  add("calathea", 0.25, -1.9, 0.85, 3.6);
  add("begonia", 2.65, -1.15, 0.9, 2.2);
  add("philodendron", 2.85, -0.6, 0.95, 4.4);
  add("leaf-litter", 1.3, -2.05, 1);
  add("fittonia", -0.95, -2.05, 0.9);
  // The pond in the back corner: java moss and cobbles under the water,
  // sedge and a tree fern on its bank.
  add("java-moss", -2.95, -2.05, 1);
  add("cobble", -2.55, -1.6, 0.9, 1.1);
  add("cobble", -3.05, -1.45, 0.8, 2.6);
  add("grass", -1.7, -1.35, 0.85, 0.3);
  add("grass", -2.3, -1.2, 0.8, 2.6);
  add("tree-fern", -1.9, -0.4, 0.9, 2.1);
  // The left side: a fallen log with fungus, ferns and leaf litter.
  add("log", -2.55, 0.45, 0.85, 1.5, "fern");
  add("turkey-tail", -2.53, 0.6, 0.9, 0.4);
  stack(0.24);
  add("fern", -2.65, -0.3, 0.8, 2.1);
  add("peace-lily", -1.65, -0.05, 0.85, 1.2);
  add("bonnet-mushrooms", -2.95, 1.05, 0.9, 2.2);
  // The front slope, where the poison frogs patrol among the bromeliads.
  add("bromeliad", 0.25, 1.05, 0.85, 2.3);
  add("calathea", -1.2, 1.15, 0.85, 0.2);
  add("fittonia", 0.45, 1.75, 0.9);
  add("leaf-litter", -0.4, 1.95, 1.1);
  add("dart-frog", -0.35, 1.3, 1.15, 1.1);
  add("dart-frog", -0.95, 0.75, 1.15, 3.5);
  add("dart-frog", 0.6, 0.75, 1.15, 5.2);
  // An old stump in the front corner, and a root arch the frogs can shelter
  // under, with an elephant ear for height on this side.
  add("stump", -2.8, 1.8, 1.2, 0.6, "sheet");
  add("chicken-of-the-woods", -2.6, 1.85, 0.9, 1.6);
  stack(0.32);
  add("root-arch", -1.65, 1.6, 0.9, 2.5, "cushion");
  add("alocasia", -2.9, 1.0, 0.85, 0.8);
  add("fern", -1, 1.7, 0.7, 5.1);
  // The lagoon: sunken wood with java fern on it, crypts and java moss on
  // the bottom, sedge and a basking stone on the shore.
  add("wood", 2.1, 1.35, 1.0, 0.6, "java");
  add("java-fern", 1.8, 1.1, 1);
  add("java-fern", 2.55, 1.75, 0.9, 2);
  add("cryptocoryne", 2.9, 0.75, 1, 1.3);
  add("cryptocoryne", 1.35, 2.15, 0.9, 3.8);
  add("java-moss", 2.95, 2.1, 1);
  add("pebbles", 2.3, 2.1, 1, 0.4);
  add("grass", 0.6, 2.15, 0.9, 1.4);
  add("grass", 2.6, -0.35, 0.85, 3.1);
  add("rock", 0.75, 1.1, 0.6, 1.8);
  add("turtle", 0.45, 1.45, 1, 2.4);
  for (const [kind, x, z, scale] of [
    ["sheet-moss", -1.65, 0.6, 1.1],
    ["fern-moss", 0.75, 0.15, 1],
    ["moss", -2.35, -0.35, 1],
    ["sheet-moss", 2.2, -0.8, 1],
    ["fern-moss", -1.0, -1.25, 0.9],
  ] as const)
    add(kind, x, z, scale);
  for (const [x, z, turn] of [
    [1.5, 1.4, 0.2],
    [2.2, 0.8, 0.1],
    [2.9, 1.35, 3.3],
    [2.95, 1.6, 3.1],
  ])
    add("convict-cichlid", x, z, 0.8, turn);
  add("micro-crab", 2.25, 1.85, 1, 0.6);
  add("micro-crab", -2.9, -2.1, 1, 2.5);
  // Green-and-black poison frogs, bolder than the strawberry frogs, on the
  // left, back and right slopes.
  for (const [x, z, heading] of [
    [-1.55, 0.95, 2.2],
    [0.95, -1.75, 4.4],
    [2.1, -0.35, 0.9],
  ])
    add("green-dart-frog", x, z, 1, heading);
  // Glass frogs on the leaves over the brook and the lagoon.
  add("glass-frog", 1.2, -0.35, 1, 2.8);
  add("glass-frog", 2.75, -0.95, 1, 1.2);
  return objects;
}

/** A planted island in a deep lagoon, as hobbyists build a paludarium:
 * mantellas and day geckos on land, vampire crabs on the shore, and tetras,
 * gouramis, shrimp and micro crabs in the water. */
function tropicalIsland(add: Add, objects: HabitatObject[]) {
  // Big leaves on the high ground, for the geckos to climb.
  add("monstera", -1.75, -1.25, 1.45, 0);
  add("swiss-cheese-plant", -0.65, -0.95, 1.3, 0.8);
  add("alocasia", 0.35, -1.35, 1.15, 2);
  add("peace-lily", -0.05, -0.55, 0.8, 2.9);
  add("tree-roots", -2.45, -0.75, 1, 1.6);
  add("wood", 0.75, -1.55, 1, 4.2);
  add("forked-branch", 0.3, -0.45, 1, 2.6);
  for (const [kind, x, z, scale, rotation] of [
    ["fern", -2.25, -1.55, 0.75, 4.5],
    ["fern", -1.65, -0.45, 1.1, 2.2],
    ["fern", -0.55, -0.15, 0.75, 4.1],
    ["fittonia", -1.2, -0.85, 1, 1.1],
    ["fittonia", -2.0, -0.95, 1, 3.4],
    ["moss", -1.1, 0.05, 1, 0.3],
    ["moss", -0.3, 0.2, 1, 2.6],
    ["moss", 0.45, -0.75, 1, 4.4],
    ["moss", -1.75, -0.15, 0.9, 1.7],
  ] as const)
    add(kind, x, z, scale, rotation);
  // Sedge, river stones and epiphytes where the island meets the water.
  for (const [kind, x, z, scale, rotation] of [
    ["grass", -2.6, -1.3, 1, 0.5],
    ["grass", -2.1, -0.15, 0.9, 2.1],
    ["anubias", -2.75, -0.5, 1, 0.6],
    ["java-fern", -2.45, 0.1, 1, 2.8],
  ] as const)
    add(kind, x, z, scale, rotation);
  // River stones and pebbles resting on the ledges down the island's sides.
  for (const [kind, x, z, scale, rotation] of [
    ["rock", 0.4, 0.55, 0.6, 0.4],
    ["pebbles", 0.1, 0.7, 0.9, 2.1],
    ["pebbles", -1.6, 0.65, 1, 0.8],
    ["rock", 1.4, -0.2, 0.55, 2.7],
    ["pebbles", -3.05, -0.45, 0.9, 4.0],
  ] as const)
    add(kind, x, z, scale, rotation);
  // Tall vallisneria in the open water, swords and rotala in front.
  for (const [kind, x, z, scale, rotation] of [
    ["vallisneria", 3.05, 0.2, 1, 5.6],
    ["vallisneria", 2.75, 0.75, 1.1, 1.4],
    ["vallisneria", 2.6, 0.35, 0.9, 2.9],
    ["spiderwood", 2.3, 1.1, 1, 0.9],
    ["amazon-sword", -1.1, 1.05, 1, 0.9],
    ["amazon-sword", -0.3, 1.35, 0.9, 3.3],
    ["rotala", -2.75, 1.75, 1, 1.9],
    ["java-fern", -1.6, 1.8, 1, 5.1],
  ] as const)
    add(kind, x, z, scale, rotation);
  for (const [x, z, heading] of [
    [-1.4, -0.5, 0.4],
    [-0.7, -0.2, 2.1],
    [-1.1, -1.0, 4.6],
  ])
    add("golden-mantella", x, z, 1, heading);
  add("gecko", -1.95, -1.25, 1, 1.2);
  add("gecko", 0.15, -1.1, 1, 3.9);
  // The vampire crabs get the islet to themselves, with a stone to hide
  // under and sedge and anubias around its edge.
  add("rock", 3.1, -1.5, 0.55, 1.3);
  add("grass", 2.3, -1.0, 0.9, 3.7);
  add("anubias", 2.05, -1.45, 1, 4.5);
  add("vampire-crab", 2.5, -0.95, 1, 2.4);
  add("vampire-crab", 2.6, -1.5, 1, 5.6);
  for (let i = 0; i < 6; i++)
    add(
      "cardinal-tetra",
      0.3 + (i % 3) * 0.3,
      1.1 + Math.floor(i / 3) * 0.3,
      1,
      0.4,
    );
  add("pearl-gourami", 2.1, 0.0, 1, 3.6);
  add("pearl-gourami", 1.4, 1.5, 1, 2.2);
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
 * and a wildflower meadow, into a deep trout pool. */
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
    ["kinnikinnick", -2.9, -1.7, 1.1],
    ["kinnikinnick", -1.1, -1.5, 1],
    ["kinnikinnick", 3.3, -1.75, 1],
    ["fly-agaric", 2.5, -1.25, 0.75],
    ["fly-agaric", 2.66, -1.14, 0.6],
    ["bolete", -1.35, -1.15, 1],
    ["fern", -1.5, -0.75, 0.65],
    ["fern", -0.75, -0.85, 0.75],
    ["fern", 2.6, -0.75, 0.6],
    ["fern", 3.3, -0.3, 0.7],
    ["columbine", 3.65, -0.55, 0.9],
    ["columbine", 4.2, -0.75, 1],
  ] as const)
    add(kind, x, z, scale, x * 1.7);
  // A granite knoll where the fence lizard suns itself.
  add("granite", 0.3, -1.45, 1.3, 1.1, "cushion");
  add("scree", 1.0, -1.25, 1.1, 2);
  add("granite", -0.25, -1.15, 0.9, 2.4);
  add("scree", 0.8, -0.8, 1, 0.8);
  add("fence-lizard", 0.6, -1.0, 1.1, 2.2);
  // Boulders, river stones and gravel along the creek, with sedge and
  // hairgrass on the damp banks.
  add("granite", -2.9, -0.7, 1, 1.3);
  add("rock", -1.0, 0.35, 0.7, 2, "fern");
  add("rock", 0.15, -0.25, 0.6, 0.5);
  add("granite", 1.75, 1.65, 0.9, 0.2);
  add("scree", -4.0, -1.3, 1, 1.6);
  for (const [x, z, scale] of [
    [-2.0, 0.15, 1.2],
    [0.0, 0.55, 1.1],
    [3.05, 1.7, 1.1],
  ])
    add("pebbles", x, z, scale, x);
  add("flagstone", 0.0, 1.6, 1.1, 2.1);
  add("flagstone", 2.3, -0.15, 0.9, 0.7);
  for (const [kind, x, z, scale] of [
    ["grass", -2.35, -0.85, 1],
    ["grass", -0.8, -0.5, 0.9],
    ["grass", 3.3, 0.12, 1],
    ["grass", 4.15, 0.38, 0.9],
    ["hairgrass", -3.4, 0.55, 1.1],
    ["hairgrass", -1.9, 0.6, 1],
    ["hairgrass", -0.6, 0.8, 0.9],
    ["hairgrass", 0.2, 1.45, 1],
    ["cattail", 1.3, -0.25, 1],
    ["cattail", 1.65, -0.2, 0.85],
    ["cattail", 2.05, -0.2, 0.9],
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
    ["strawberry", -4.0, 1.2, 1],
    ["strawberry", -1.6, 1.6, 0.9],
    ["kinnikinnick", -3.9, 1.65, 1],
    ["kinnikinnick", -0.95, 1.75, 0.9],
    ["spruce", -4.1, 0.2, 0.75],
  ] as const)
    add(kind, x, z, scale, x * 1.3);
  add("log", -2.2, 1.35, 1, 0.3, "sheet");
  add("tiger-salamander", -2.0, 1.0, 1, 1.4);
  // Under the water: boulders, a sunken snag and log on the gravel,
  // eelgrass and ludwigia along the back of the pool, and sagittaria in the
  // shallows.
  add("granite", 2.9, 0.0, 1.2, 2.6, "sheet");
  add("slate", 1.05, 1.3, 0.9, 1.2);
  add("snag", 2.2, -0.05, 1, 2.8);
  add("log", 3.9, 0.7, 0.9, 1.1);
  for (const [kind, x, z, scale] of [
    ["cobble", 1.0, 0.75, 1],
    ["cobble", 4.0, 1.75, 0.9],
    ["pebbles", 1.9, 1.05, 1.1],
    ["vallisneria", 1.3, 0.1, 1.2],
    ["vallisneria", 1.8, 0.15, 1.3],
    ["ludwigia", 2.55, 0.25, 1.1],
    ["dwarf-sagittaria", 0.75, 0.1, 1],
    ["dwarf-sagittaria", 2.9, 1.6, 0.9],
    ["java-moss", 1.4, 0.95, 1],
    ["water-lily", 0.9, 0.35, 0.8],
    ["water-lily", 3.1, 1.15, 0.9],
  ] as const)
    add(kind, x, z, scale, x * 2.7);
  // Trout in open water, sculpins and crayfish on the stones, and the
  // canyon tree frog on a flat stone at the edge.
  add("cutthroat-trout", 1.6, 0.5, 0.8, 0);
  add("cutthroat-trout", 2.6, 1.1, 0.75, 3);
  add("cutthroat-trout", 3.6, 1.7, 0.75, 0.4);
  add("sculpin", 1.1, 0.45, 1, 3);
  add("sculpin", 1.6, 0.3, 1, 0.5);
  add("sculpin", 2.65, 1.0, 1, 2);
  add("dwarf-crayfish", 1.5, 0.95, 1, 1.1);
  add("dwarf-crayfish", 1.1, 0.25, 1, 4);
  add("dwarf-crayfish", 3.8, 1.5, 1, 2.4);
  add("canyon-tree-frog", 0.0, 1.6, 1.2, 0.4);
  return objects;
}

/** A shady Vietnamese limestone grotto over a rocky Asian stream. Up top,
 * mossy frogs live in caves on a karst shelf, among begonias and elephant
 * ears. Below the cliff, rasboras, barbs and gouramis swim over crypts and
 * river stones. */
function limestoneGrotto(
  add: Add,
  shelter: Shelter,
  stack: Stack,
  objects: HabitatObject[],
) {
  // Karst stone along the top of the wall in broken tiers, furred with moss
  // and leaving room for the seep's gully.
  add("limestone-pinnacle", -2.55, -2.25, 1.35, 0.6, "cushion");
  add("limestone", -1.45, -2.24, 1, 1);
  add("limestone-pinnacle", -1.4, -2.42, 0.7, 2.6, "sheet");
  stack(0.7);
  add("limestone-pinnacle", 0.2, -2.24, 1.2, 2.2, "java");
  add("limestone", 2.45, -2.25, 1.1, 0.3, "sheet");
  add("limestone", 2.5, -2.42, 0.6, 3.4, "cushion");
  stack(0.8);
  add("capstone", -0.7, -2.25, 1);
  add("orchid", -0.6, -1.5, 0.8, 0.9);
  add("orchid", 2.75, -1.65, 0.75, 2.4);
  add("nest-fern", -0.35, -1.3, 0.8, 1.3);
  add("nest-fern", 1.65, -1.95, 0.7, 4);
  add("fittonia", 0.95, -0.55, 1);
  for (const [kind, x, z, scale] of [
    ["sheet-moss", -2.1, -1.95, 1],
    ["fern-moss", 1.05, -2.0, 0.9],
    ["moss", -0.45, -1.2, 0.8],
  ] as const)
    add(kind, x, z, scale);
  // Smaller stones and loose cobbles at the foot of the wall.
  add("limestone", -2.15, -1.8, 0.75, 4.2, "fern");
  add("rock", -0.5, -1.85, 0.55, 2.4, "sheet");
  add("limestone-pinnacle", 0.15, -1.75, 0.8, 1.2, "cushion");
  add("limestone", 2.25, -1.8, 0.65, 5.1, "fern");
  add("slate", -2.85, -1.6, 0.55, 0.9);
  add("cobble", -2.8, -1.6, 0.9, 2);
  stack(0.12);
  add("cobble", -1.1, -1.75, 1, 0.7);
  add("cobble", 2.95, -1.55, 0.9, 3.3);
  // Two caves on the shelf, where the mossy frogs rest by day, with
  // elephant ears and begonias crowding the entrances.
  shelter(-1.85, -1.15, 0.3, "cushion");
  shelter(2.35, -1.2, 2.6, "sheet");
  add("mossy-frog", -1.7, -0.75, 1, 0.6);
  add("mossy-frog", 2.05, -0.85, 1, 2.4);
  add("mossy-frog", -0.2, -1.3, 1, 4);
  add("alocasia", -2.45, -0.95, 1.05, 0.5);
  add("alocasia", 2.5, -0.55, 0.95, 2.4);
  add("alocasia", -0.75, -1.4, 0.8, 1.6);
  add("begonia", -2.75, -0.35, 1, 0.3);
  add("begonia", -1.0, -0.8, 0.9, 2.8);
  add("begonia", 1.65, -1.0, 0.95, 1.6);
  add("begonia", -0.35, -0.7, 0.85, 4.4);
  add("fern", -2.15, -0.1, 0.85, 1.1);
  add("fern", -0.9, -1.7, 0.8, 2);
  // Mossy stones, wood and java fern where the seep crosses the shelf.
  add("rock", 1.4, -1.55, 0.6, 0.8, "java");
  add("wood", 0.35, -0.95, 0.8, 2.1, "java");
  add("java-fern", 1.45, -0.95, 0.9, 1.2);
  for (const [kind, x, z, scale] of [
    ["sheet-moss", -1.35, -0.45, 1.1],
    ["fern-moss", 0.0, -1.0, 1],
    ["moss", 0.85, -1.7, 0.9],
    ["sheet-moss", -2.55, -0.65, 0.9],
  ] as const)
    add(kind, x, z, scale);
  // Leaf litter and fungus near the cliff's edge.
  add("fungus-log", -1.1, -0.35, 0.8, 0.3);
  add("leaf-litter", -2.0, -0.3, 1);
  add("leaf-litter", 0.6, -1.5, 0.9);
  add("bonnet-mushrooms", -1.4, -0.2, 0.85, 1.1);
  add("bonnet-mushrooms", -2.45, -1.45, 0.85, 2.7);
  // River stones along the foot of the cliff and on a step partway down it,
  // with java fern and java moss growing on some.
  add("quaternius-outcrop", -2.5, 1.15, 1.2, 0.4, "java");
  add("quaternius-boulder", -1.3, 0.9, 0.9, 2.1);
  add("quaternius-crag", -0.15, 0.65, 1, 1);
  add("quaternius-outcrop", 1.6, 0.35, 0.9, 2.8, "java");
  add("quaternius-boulder", 2.75, 0.7, 0.8, 1.6);
  add("java-fern", -1.95, 1.6, 1.1);
  add("java-fern", 2.2, 0.4, 1);
  add("java-fern", 0.3, 0.9, 0.9);
  for (const [x, z, scale] of [
    [-2.05, 2.35, 1],
    [-0.8, 1.15, 1.1],
    [1.15, 0.5, 1],
    [2.4, 0.85, 0.9],
    [-1.8, 2.1, 1],
    [2.1, 2.0, 0.9],
  ])
    add("java-moss", x, z, scale);
  // Rotala and eelgrass up against the cliff, crypts through the middle,
  // and a lawn of sagittaria in front.
  for (const [x, z] of [
    [-2.9, 1.7],
    [-0.6, 0.75],
    [0.6, 0.6],
  ])
    add("rotala", x, z, 1.2);
  for (const [x, z] of [
    [-1.95, 0.95],
    [0.3, 0.8],
    [2.2, 0.95],
  ])
    add("vallisneria", x, z, 1.3);
  for (const [x, z, scale] of [
    [-1.6, 1.75, 1],
    [-1.25, 2.05, 0.85],
    [0.5, 1.8, 0.9],
    [1.9, 1.55, 1],
    [2.3, 1.85, 0.85],
    [2.0, 0.75, 0.8],
  ])
    add("cryptocoryne", x, z, scale, x * 2);
  for (const [x, z] of [
    [-2.6, 2.35],
    [-0.9, 2.3],
    [0.3, 2.35],
    [1.4, 2.4],
    [2.45, 2.35],
  ])
    add("dwarf-sagittaria", x, z, 1);
  add("quaternius-dome", -2.4, 1.9, 0.6, 1.2);
  add("pebbles", -0.6, 2.0, 1);
  add("pebbles", 1.1, 1.85, 0.9, 2.2);
  add("quaternius-crag", 2.85, 2.1, 0.55, 3);
  add("water-lily", -2.75, 2.2, 0.9, 1);
  // A school each of rasboras and tiger barbs, two gouramis and a rainbow
  // shark in the open water, and cherry shrimp and micro crabs on the stones.
  for (let i = 0; i < 8; i++)
    add(
      "harlequin-rasbora",
      -1.3 + (i % 4) * 0.25,
      1.35 + Math.floor(i / 4) * 0.3,
      1,
      1.2,
    );
  for (let i = 0; i < 6; i++)
    add(
      "tiger-barb",
      0.8 + (i % 3) * 0.3,
      1.1 + Math.floor(i / 3) * 0.3,
      1,
      4.2,
    );
  add("pearl-gourami", -0.2, 1.9, 1, 2.4);
  add("pearl-gourami", -2.2, 1.6, 1, 0.8);
  add("rainbow-shark", 0.9, 2.2, 1, 1.8);
  for (const [x, z, heading] of [
    [-2.6, 1.55, 0.4],
    [-0.05, 1.0, 2.2],
    [1.75, 0.75, 5.1],
    [-0.4, 2.2, 3],
  ])
    add("cherry-shrimp", x, z, 1, heading);
  for (const [x, z, heading] of [
    [-2.15, 1.7, 1.1],
    [-0.4, 1.8, 3.6],
    [1.3, 1.65, 5.4],
  ])
    add("micro-crab", x, z, 1, heading);
  // Crocodile newts wander the moss at the shelf's edge, where they can drop
  // into the pool.
  add("crocodile-newt", -0.6, -0.35, 1, 2.6);
  add("crocodile-newt", 1.75, -0.55, 1, 5.1);
  // Bucephalandra on the wet stone by the seep, on the step down the cliff,
  // and under the water.
  for (const [x, z, rotation] of [
    [1.15, -1.2, 0.7],
    [1.05, 0.15, 2.4],
    [-1.0, 1.15, 4.1],
  ])
    add("bucephalandra", x, z, 1, rotation);
  return objects;
}

/** A Mojave desert spring in the biggest tank: a sandstone mesa and a low
 * ridge along the back, open dunes in front, and a spring in the middle with
 * pupfish, cattails and canyon tree frogs. Lizards, two tortoises, a scorpion
 * and a tarantula live on the dry ground around it. */
function desertSpring(add: Add, shelter: Shelter, objects: HabitatObject[]) {
  // The mesa, with a cave at its foot.
  add("sandstone", -5.3, -2.7, 1.8, 1);
  add("sandstone", -3.7, -2.8, 1.4, 0);
  add("sandstone-pillar", -4.5, -3.0, 1.3, 0.8);
  add("sandstone-ledge", -2.5, -2.2, 1.2, 2.1);
  add("sandstone-ledge", -5.7, -1.4, 1, 0.3);
  shelter(-3.5, -1.2, 1.4);
  add("dead-tree", -4.7, -2.0, 1.2, 0.9);
  add("agave", -2.9, -3.05, 1.1, 1.6);
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
  add("sandstone", 4.8, -2.8, 1.5, 0.4);
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

/** Pale sand sloping up toward the back glass under warm, dim light, like
 * tea-stained blackwater. */
function blackwater(): Environment {
  const env = sculpt(
    level(
      {
        ...defaultEnvironment,
        water: AQUARIUM_WATER,
        brightness: 0.6,
      },
      0.35,
    ),
    [
      [
        "raise",
        1.6,
        [
          [-3.5, -2.2],
          [3.5, -2.2],
        ],
      ],
    ],
  );
  return {
    ...env,
    terrain: { ...env.terrain!, paint: env.terrain!.paint.map(() => "sand") },
  };
}

/** A knoll in the middle of the tank, so it reads from every side. Two
 * springs at its top keep it wet: one runs down to a lagoon across the
 * front-right corner, the other to a pond in the back-left corner. */
function forestFloor() {
  const brooks: [number, number][][] = [
    [
      [-0.35, -0.35],
      [0.2, -0.45],
      [0.8, -0.35],
      [1.4, -0.05],
      [1.9, 0.35],
    ],
    [
      [-0.8, -0.45],
      [-1.3, -0.75],
      [-1.8, -1.1],
      [-2.25, -1.45],
    ],
  ];
  const env: Environment = {
    ...defaultEnvironment,
    width: 7,
    depth: 5,
    height: 4.2,
    water: 0.7,
    warmth: 0.3,
    brightness: 0.9,
  };
  const smooth = (t: number) => {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  };
  // 0 outside a lumpy ellipse, rising smoothly to 1 at its centre.
  const dome = (
    x: number,
    z: number,
    [cx, cz, rx, rz, lumps]: [number, number, number, number, number],
  ) => {
    const angle = Math.atan2(z - cz, x - cx);
    const edge =
      1 + 0.16 * Math.sin(3 * angle + lumps) + 0.08 * Math.sin(5 * angle);
    return smooth(1 - Math.hypot((x - cx) / rx, (z - cz) / rz) / edge);
  };
  const brookDistance = (x: number, z: number) =>
    Math.min(...brooks.map((brook) => nearestOnPath(x, z, brook).distance));
  const terrain = newTerrain(env, (x, z) => {
    // Low ground stays damp; plants up the knoll drink from the brooks.
    const floor = 0.9 + 0.04 * Math.sin(x * 1.7 + z * 1.1);
    const knoll =
      1.0 * dome(x, z, [-0.5, -0.3, 2.1, 1.8, 0.5]) +
      0.35 * dome(x, z, [0.55, -1.05, 1.0, 0.85, 2]);
    const lagoon = Math.min(1, 1.6 * dome(x, z, [2.25, 1.2, 2.05, 1.8, 4]));
    const pond = Math.min(1, 1.8 * dome(x, z, [-2.8, -1.9, 1.2, 1.05, 1]));
    let ground = floor + knoll;
    ground += (-0.15 - ground) * lagoon;
    ground += (0.3 - ground) * pond;
    const brook = brookDistance(x, z);
    const channel = 1 - smooth((brook - 0.1) / 0.3);
    // A low bank of moss beside the stones keeps the brook that runs down
    // to the lagoon in its bed where the knoll slopes away across it. Unlike
    // the bed, it stays full height down to the water, since the low ground
    // is where the brook strays.
    const fromBrook = nearestOnPath(x, z, brooks[0]).distance;
    const bank =
      smooth((fromBrook - 0.2) / 0.1) * (1 - smooth((fromBrook - 0.3) / 0.4));
    const height =
      ground +
      0.08 * bank * smooth((ground - env.water) / 0.2) -
      0.14 * channel * smooth(ground - env.water);
    return Math.round((height - baseGroundHeight(x, z, env)) * 100) / 100 || 0;
  });
  const paint = terrain.heights.map((_, i): GroundMaterial => {
    const { x, z } = terrainPoint(i, { ...env, terrain });
    const ground = groundHeight(x, z, { ...env, terrain });
    // Pools in forest are dark with silt and fallen leaves, and bare earth
    // breaks up the moss in patches.
    if (ground < env.water + 0.1) return "soil";
    if (brookDistance(x, z) < 0.25) return "stone";
    const patches = Math.sin(x * 2.3 + z * 1.7) * Math.sin(x * 1.1 - z * 2.9);
    if (patches > 0.55) return "soil";
    return "moss";
  });
  return {
    ...env,
    terrain: { ...terrain, paint },
    springs: brooks.map((brook) => springAt(env, brook[0], 0.4)),
  };
}

/** A tall tank split in two: a mossy karst shelf with a wall behind it up
 * top, and a deep stream aquarium below a cliff along the shelf's edge. A
 * seep runs down the wall and across the shelf, and falls off the cliff. */
function grottoFloor() {
  const seep: [number, number][] = [
    [1.3, -2.7],
    [1.2, -2.0],
    [0.95, -1.3],
    [0.8, -0.6],
    [0.75, 0.5],
  ];
  const env: Environment = {
    ...defaultEnvironment,
    width: 6.5,
    depth: 5.5,
    height: 3.8,
    water: 1.8,
    warmth: 0.6,
    brightness: 0.9,
  };
  const smooth = (t: number) => {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  };
  const terrain = newTerrain(env, (x, z) => {
    // The shelf's edge wanders, reaching furthest out on the left.
    const edge = 0.2 - 0.3 * Math.sin(x * 1.1 + 0.6) - 0.08 * Math.sin(x * 3.3);
    const cliff = smooth((edge - z) / 0.45);
    const wall =
      (1.05 + 0.12 * Math.sin(x * 2.3) + 0.06 * Math.sin(x * 5.1 + 1)) *
      smooth((-1.9 - z) / 0.8);
    const shelf =
      2.1 + 0.04 * Math.sin(x * 1.7 - z * 1.3) + 0.08 * smooth((-0.9 - z) / 1);
    const floor = 0.3 + 0.05 * Math.sin(x * 1.3 + z * 0.9);
    // A rocky step partway down the cliff on the right, for plants to
    // grow on under the water.
    const step = smooth((edge + 0.75 - z) / 0.3) * smooth((x - 0.9) / 0.5);
    const ground = Math.max(
      floor + (shelf + wall - floor) * cliff,
      floor + (1.05 - floor) * step,
    );
    // The seep cuts a gully down the wall and a shallow bed across the shelf.
    const channel =
      1 - smooth((nearestOnPath(x, z, seep).distance - 0.15) / 0.3);
    const height = ground - 0.12 * channel * cliff;
    return Math.round((height - baseGroundHeight(x, z, env)) * 100) / 100;
  });
  // Moss over the shelf, bare stone up the wall and down the cliff, and
  // gravel under the water.
  const paint = terrain.heights.map((_, i): GroundMaterial => {
    const { x, z } = terrainPoint(i, { ...env, terrain });
    const ground = groundHeight(x, z, { ...env, terrain });
    if (ground < env.water) return "sand";
    if (ground < env.water + 0.25 || z < -2.1) return "stone";
    return "moss";
  });
  return sculpt(
    {
      ...env,
      terrain: { ...terrain, paint },
      springs: [springAt(env, seep[0], 0.5)],
    },
    [
      [
        "moss",
        0.5,
        [
          [-2.8, -2.4],
          [0.4, -2.5],
        ],
      ],
      [
        "moss",
        0.5,
        [
          [2.0, -2.3],
          [3.0, -2.2],
        ],
      ],
      ["stone", 0.4, seep.slice(0, -1)],
    ],
  );
}

/** A long tank where a creek trickles out of a spring on the stony slope at
 * the back, and runs diagonally down to the meadow at the front, deepening
 * and widening into a stream with room for trout. */
function creekBed() {
  const creek: [number, number][] = [
    [-4.35, -1.45],
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
  const creekLength = pathLength(creek);
  const env: Environment = {
    ...defaultEnvironment,
    width: 9,
    depth: 4.2,
    water: 0.8,
    warmth: 0.3,
    brightness: 0.75,
  };
  const smooth = (t: number) => {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  };
  const terrain = newTerrain(env, (x, z) => {
    const slope = 0.4 * smooth((-z - 0.3) / 1.6);
    const knoll = 0.12 * smooth(1 - Math.hypot(x - 0.4, z + 1.6) / 1.3);
    const meadow = 0.1 * smooth(1 - Math.hypot(x + 3, z - 1.3) / 1.4);
    const ground = 1.11 + slope + knoll + meadow;
    // The bed falls steadily from the spring, a narrow groove above the
    // water at first, then a stream that keeps deepening and widening all
    // the way to the glass.
    const { distance, along } = nearestOnPath(x, z, creek);
    const f = along / creekLength;
    const bed = env.water - 0.65 + 1.21 * (1 - f) ** 1.7;
    const width = 0.1 + 0.8 * smooth((f - 0.25) / 0.75);
    const channel = 1 - smooth((distance - width) / 0.5);
    const height = ground + (Math.min(bed, ground - 0.08) - ground) * channel;
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
  return sculpt({ ...env, terrain, springs: [springAt(env, creek[0], 1)] }, [
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
  const ridge: [number, number][] = [
    [-2.6, -1.25],
    [-1.3, -1.5],
    [0.2, -1.35],
  ];
  const ledges = [
    { x: 0.3, z: 0.6, y: 1.0, radius: 0.4 },
    { x: -1.6, z: 0.65, y: 1.08, radius: 0.35 },
    { x: 1.4, z: -0.2, y: 1.08, radius: 0.35 },
    { x: -3.05, z: -0.45, y: 1.0, radius: 0.35 },
  ];
  const terrain = newTerrain(
    env,
    (x, z) => {
      const floor = 0.14 + 0.04 * Math.sin(x * 1.3 + z * 0.9);
      // The island climbs from a low beach in front to a ridge along the
      // back, above a shelf partway down that breaks up its underwater slope.
      const island = Math.max(
        mound(x + 0.7, z + 0.55, 2.9, 1.8),
        mound(x + 2.0, z + 0.9, 1.6, 1.4),
      );
      const top =
        1.45 + 0.32 * smooth(1 - nearestOnPath(x, z, ridge).distance / 1.2);
      const shelf = mound(x + 0.7, z + 0.45, 3.5, 2.3);
      const islet = mound(x - 2.6, z + 1.05, 1.6, 1.3);
      let height = Math.max(
        floor + (top - floor) * island,
        floor + (0.85 - floor) * shelf,
        floor + (1.5 - floor) * islet,
      );
      // Small flat ledges stepped into the slope, for stones to sit on.
      for (const ledge of ledges) {
        const distance = Math.hypot(x - ledge.x, z - ledge.z) - ledge.radius;
        height = Math.max(height, ledge.y - 0.6 * smooth(distance / 0.5));
      }
      return Math.round((height - baseGroundHeight(x, z, env)) * 100) / 100;
    },
    "sand",
  );
  // Moss over the island and the islet. Sand everywhere else keeps to a
  // single paint edge, at the shore.
  return sculpt({ ...env, terrain }, [
    [
      "moss",
      1.0,
      [
        [-2.1, -0.8],
        [-0.9, -0.6],
        [0.2, -0.8],
      ],
    ],
    ["moss", 0.5, [[2.65, -1.25]]],
  ]);
}

/** A spring at a spot given in tank coordinates. */
function springAt(
  env: Environment,
  [x, z]: [number, number],
  flow: number,
): Spring {
  // Rounded to keep preset share links short.
  const fraction = (n: number) => Math.round(n * 1000) / 1000;
  return { x: fraction(x / env.width), z: fraction(z / env.depth), flow };
}

/** How far a spot is from the nearest point on a path, and how far along
 * the path that point is. */
function nearestOnPath(x: number, z: number, path: [number, number][]) {
  let distance = Infinity,
    along = 0,
    start = 0;
  for (let i = 1; i < path.length; i++) {
    const [x0, z0] = path[i - 1],
      [x1, z1] = path[i];
    const dx = x1 - x0,
      dz = z1 - z0,
      length = Math.hypot(dx, dz);
    const t = Math.min(
      1,
      Math.max(0, ((x - x0) * dx + (z - z0) * dz) / (length * length)),
    );
    const d = Math.hypot(x - x0 - t * dx, z - z0 - t * dz);
    if (d < distance) {
      distance = d;
      along = start + t * length;
    }
    start += length;
  }
  return { distance, along };
}

function pathLength(path: [number, number][]) {
  let length = 0;
  for (let i = 1; i < path.length; i++)
    length += Math.hypot(
      path[i][0] - path[i - 1][0],
      path[i][1] - path[i - 1][1],
    );
  return length;
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
