import * as THREE from "three";
import type { AssetKind, HabitatObject } from "../model/schema";
import { randomFromSeed } from "../model/random";
import type { AssetDefinition } from "./types";
import { batchStaticAsset } from "./batch";
import type { MossSpecies } from "../model/moss";
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
import { leafLitter } from "./landscape/leafLitter";

export type { AssetDefinition, Category, AnimalBehavior } from "./types";

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
  snail,
  turtle,
  "desert-tortoise": desertTortoise,
  monstera,
  "swiss-cheese-plant": swissCheesePlant,
  "tree-philodendron": treePhilodendron,
  alocasia,
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
  anubias,
  "java-fern": javaFern,
  cryptocoryne,
  "water-lily": waterLily,
  moss: cushionMoss,
  "sheet-moss": sheetMoss,
  "fern-moss": fernMoss,
  "java-moss": javaMoss,
  rock,
  wood,
  branch,
  log,
  "rock-shelter": rockShelter,
  "leaf-litter": leafLitter,
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
} satisfies Record<AssetKind, AssetDefinition>;

export const catalog: readonly AssetDefinition[] = Object.values(assets);

/** Animals living on the habitat's surfaces, simulated by the ecosystem.
 * Fish swim separately. */
/** Anything alive that can be watched: land animals and fish. */
export function isAnimal(kind: AssetKind): boolean {
  return assets[kind].category === "Animals";
}
export function isLandAnimal(kind: AssetKind): boolean {
  return assets[kind].behavior !== undefined;
}
export function plantPerches(object: HabitatObject) {
  return assets[object.kind].perches?.(randomFromSeed(object.seed)) ?? [];
}

export function objectDens(object: HabitatObject) {
  return assets[object.kind].dens?.(randomFromSeed(object.seed)) ?? [];
}

export function buildAsset(
  kind: AssetKind,
  seed = 1,
  moss?: MossSpecies,
): THREE.Group {
  const asset = assets[kind];
  const model = asset.build(randomFromSeed(seed));
  if (asset.category === "Animals") return model;
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
