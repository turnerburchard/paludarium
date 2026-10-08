import * as THREE from "three";
import type { AssetKind, HabitatObject } from "../model/schema";
import { randomFromSeed } from "../model/random";
import {
  groupCategories,
  type AssetDefinition,
  type Biome,
  type Category,
} from "./types";
import { batchStaticAsset } from "./batch";
import type { MossSpecies } from "../model/moss";
import type { Den, PlantPerch, PlantPoint } from "../model/plantSurfaces";
import { growMoss } from "./landscape/mossCover";
import {
  bluePoisonDartFrog,
  canyonTreeFrog,
  chorusFrog,
  mossyFrog,
  strawberryPoisonFrog,
  treeFrog,
} from "./animals/frogs";
import { fish } from "./animals/fish";
import {
  chuckwalla,
  desertSpinyLizard,
  fenceLizard,
  gecko,
  leopardLizard,
  tigerSalamander,
} from "./animals/lizards";
import { snail } from "./animals/snail";
import {
  scorpion,
  tarantula,
  vampireCrab,
  microCrab,
  dwarfCrayfish,
  cherryShrimp,
} from "./animals/arthropods";
import { desertTortoise, turtle } from "./animals/turtle";
import { cardinalTetra, emberTetra } from "./animals/tetras";
import { tigerBarb } from "./animals/barb";
import {
  angelfish,
  convictCichlid,
  corydoras,
  cutthroatTrout,
  harlequinRasbora,
  pearlGourami,
  pupfish,
  rainbowShark,
  sculpin,
} from "./animals/freshwater";
import { anthurium } from "./plants/anthurium";
import { philodendron } from "./plants/philodendron";
import { nestFern } from "./plants/nestFern";
import { calathea } from "./plants/calathea";
import { fittonia } from "./plants/fittonia";
import { cattail } from "./plants/cattail";
import { bromeliad } from "./plants/bromeliad";
import { fern } from "./plants/fern";
import { grass } from "./plants/grass";
import { monstera } from "./plants/monstera";
import { swissCheesePlant } from "./plants/swissCheese";
import { strawberry } from "./plants/strawberry";
import { amazonSword } from "./plants/amazonSword";
import { anubias } from "./plants/anubias";
import { javaFern } from "./plants/javaFern";
import { rotala } from "./plants/rotala";
import { vallisneria } from "./plants/vallisneria";
import { columbine } from "./plants/columbine";
import { spruce } from "./plants/spruce";
import { kinnikinnick } from "./plants/kinnikinnick";
import { pricklyPear } from "./plants/pricklyPear";
import { barrelCactus } from "./plants/barrelCactus";
import { agave } from "./plants/agave";
import { bunchgrass } from "./plants/bunchgrass";
import { cryptocoryne } from "./plants/cryptocoryne";
import { begonia } from "./plants/begonia";
import { alocasia } from "./plants/alocasia";
import { peaceLily } from "./plants/peaceLily";
import { treePhilodendron } from "./plants/treePhilodendron";
import { hairgrass } from "./plants/hairgrass";
import { orchid } from "./plants/orchid";
import { waterLily } from "./plants/waterLily";
import { hedgehogCactus } from "./plants/hedgehogCactus";
import { cushionMoss, fernMoss, javaMoss, sheetMoss } from "./landscape/mosses";
import { rock } from "./landscape/rock";
import { wood } from "./landscape/wood";
import { branch } from "./landscape/branch";
import { log } from "./landscape/log";
import { rockShelter } from "./landscape/rockShelter";
import {
  flagstone,
  granite,
  limestone,
  limestonePinnacle,
  pebbles,
  sandstone,
  sandstoneLedge,
  sandstonePillar,
  scree,
  slate,
} from "./landscape/stones";
import { fungusLog } from "./landscape/fungusLog";
import { snag } from "./landscape/snag";
import { treeRoots } from "./landscape/treeRoots";
import { stump } from "./landscape/stump";
import { deadTree } from "./landscape/deadTree";
import { bolete, bonnetMushrooms, flyAgaric } from "./landscape/mushrooms";
import { ludwigia } from "./plants/ludwigia";
import { dwarfSagittaria } from "./plants/dwarfSagittaria";
import { leafLitter } from "./landscape/leafLitter";

export type {
  AssetDefinition,
  Category,
  Biome,
  Group,
  AnimalBehavior,
} from "./types";
export { groupCategories } from "./types";

/** Every placeable thing, in the order the library shows them. */
export const assets = {
  "tree-frog": treeFrog,
  "dart-frog": strawberryPoisonFrog,
  "blue-dart-frog": bluePoisonDartFrog,
  "mossy-frog": mossyFrog,
  "chorus-frog": chorusFrog,
  "canyon-tree-frog": canyonTreeFrog,
  gecko,
  "leopard-lizard": leopardLizard,
  "desert-spiny-lizard": desertSpinyLizard,
  "fence-lizard": fenceLizard,
  chuckwalla,
  "tiger-salamander": tigerSalamander,
  turtle,
  "desert-tortoise": desertTortoise,
  monstera,
  "swiss-cheese-plant": swissCheesePlant,
  "tree-philodendron": treePhilodendron,
  alocasia,
  "peace-lily": peaceLily,
  fern,
  strawberry,
  bromeliad,
  anthurium,
  philodendron,
  "nest-fern": nestFern,
  calathea,
  fittonia,
  orchid,
  begonia,
  columbine,
  kinnikinnick,
  spruce,
  "prickly-pear": pricklyPear,
  "barrel-cactus": barrelCactus,
  "hedgehog-cactus": hedgehogCactus,
  agave,
  bunchgrass,
  hairgrass,
  cattail,
  grass,
  "amazon-sword": amazonSword,
  vallisneria,
  rotala,
  ludwigia,
  "dwarf-sagittaria": dwarfSagittaria,
  anubias,
  "java-fern": javaFern,
  cryptocoryne,
  "water-lily": waterLily,
  moss: cushionMoss,
  "sheet-moss": sheetMoss,
  "fern-moss": fernMoss,
  "java-moss": javaMoss,
  rock,
  granite,
  sandstone,
  "sandstone-pillar": sandstonePillar,
  "sandstone-ledge": sandstoneLedge,
  limestone,
  "limestone-pinnacle": limestonePinnacle,
  slate,
  flagstone,
  scree,
  pebbles,
  wood,
  branch,
  log,
  "fungus-log": fungusLog,
  snag,
  stump,
  "dead-tree": deadTree,
  "tree-roots": treeRoots,
  "rock-shelter": rockShelter,
  "leaf-litter": leafLitter,
  "fly-agaric": flyAgaric,
  bolete,
  "bonnet-mushrooms": bonnetMushrooms,
  fish,
  "cardinal-tetra": cardinalTetra,
  "ember-tetra": emberTetra,
  "tiger-barb": tigerBarb,
  angelfish,
  "pearl-gourami": pearlGourami,
  "rainbow-shark": rainbowShark,
  corydoras,
  "convict-cichlid": convictCichlid,
  "harlequin-rasbora": harlequinRasbora,
  "cutthroat-trout": cutthroatTrout,
  sculpin,
  pupfish,
  snail,
  "vampire-crab": vampireCrab,
  "stripe-tailed-scorpion": scorpion,
  "desert-tarantula": tarantula,
  "micro-crab": microCrab,
  "dwarf-crayfish": dwarfCrayfish,
  "cherry-shrimp": cherryShrimp,
} satisfies Record<AssetKind, AssetDefinition>;

export const catalog: readonly AssetDefinition[] = Object.values(assets);

export function categoryOf(asset: AssetDefinition): Category {
  return groupCategories[asset.group];
}
/** Underwater takes in anything that can live in the water, whatever its biome. */
export function livesIn(asset: AssetDefinition, place: Biome | "Underwater") {
  return place === "Underwater"
    ? asset.habitat !== "land"
    : asset.biomes.includes(place);
}
/** Animals living on the habitat's surfaces, simulated by the ecosystem.
 * Fish swim separately. */
/** Anything alive that can be watched: land animals and fish. */
export function isAnimal(kind: AssetKind): boolean {
  return categoryOf(assets[kind]) === "Animals";
}
export function isLandAnimal(kind: AssetKind): boolean {
  return assets[kind].behavior !== undefined;
}
/** Footprint at scale 1, after the asset's size calibration. */
export function assetRadius(kind: AssetKind) {
  return assets[kind].radius * (assets[kind].size ?? 1);
}

/** A scale for a new placement within the asset's range, on the same 0.05
 * steps as the size slider. */
export function placementScale(kind: AssetKind, random = Math.random) {
  const [min, max] = assets[kind].scaleRange ?? [1, 1];
  return Math.round((min + random() * (max - min)) * 20) / 20;
}

const sized = (point: PlantPoint, size: number) => ({
  x: point.x * size,
  y: point.y * size,
  z: point.z * size,
});

export function plantPerches(object: HabitatObject): PlantPerch[] {
  const asset = assets[object.kind];
  const size = asset.size ?? 1;
  return (asset.perches?.(randomFromSeed(object.seed)) ?? []).map((route) => ({
    ...route,
    stem: route.stem.map((point) => sized(point, size)),
    perch: sized(route.perch, size),
  }));
}

export function objectDens(object: HabitatObject): Den[] {
  const asset = assets[object.kind];
  const size = asset.size ?? 1;
  return (asset.dens?.(randomFromSeed(object.seed)) ?? []).map((den) => ({
    entrance: sized(den.entrance, size),
    inside: sized(den.inside, size),
  }));
}

export function buildAsset(
  kind: AssetKind,
  seed = 1,
  moss?: MossSpecies,
): THREE.Group {
  const asset = assets[kind];
  const model = asset.build(randomFromSeed(seed));
  model.scale.multiplyScalar(asset.size ?? 1);
  // Skinned meshes refresh their bind inverse only here, so bounds measured
  // before the first render would otherwise count the size twice.
  model.updateMatrixWorld(true);
  if (isAnimal(kind)) return model;
  const batched = batchStaticAsset(model);
  if (moss) growMoss(batched, moss, randomFromSeed(seed + 1));
  return batched;
}

export function disposeAsset(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (Array.isArray(object.material)
        ? object.material
        : [object.material]
      ).forEach((m) => materials.add(m));
    }
  });
  materials.forEach((m) => m.dispose());
}
