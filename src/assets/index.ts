import * as THREE from "three";
import type { AssetKind, HabitatObject } from "../model/schema";
import { randomFromSeed } from "../model/random";
import type { AssetDefinition } from "./types";
import { batchStaticAsset } from "./batch";
import {
  bluePoisonDartFrog,
  mossyFrog,
  strawberryPoisonFrog,
  treeFrog,
} from "./animals/frogs";
import { fish } from "./animals/fish";
import { gecko } from "./animals/gecko";
import { cardinalTetra, emberTetra } from "./animals/tetras";
import { anthurium } from "./plants/anthurium";
import { philodendron } from "./plants/philodendron";
import { nestFern } from "./plants/nestFern";
import { calathea } from "./plants/calathea";
import { fittonia } from "./plants/fittonia";
import { bromeliad } from "./plants/bromeliad";
import { fern } from "./plants/fern";
import { grass } from "./plants/grass";
import { monstera } from "./plants/monstera";
import { swissCheesePlant } from "./plants/swissCheese";
import { strawberry } from "./plants/strawberry";
import { moss } from "./landscape/moss";
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
  gecko,
  monstera,
  "swiss-cheese-plant": swissCheesePlant,
  fern,
  strawberry,
  bromeliad,
  anthurium,
  philodendron,
  "nest-fern": nestFern,
  calathea,
  fittonia,
  grass,
  moss,
  rock,
  wood,
  branch,
  log,
  "rock-shelter": rockShelter,
  "leaf-litter": leafLitter,
  fish,
  "cardinal-tetra": cardinalTetra,
  "ember-tetra": emberTetra,
} satisfies Record<AssetKind, AssetDefinition>;

export const catalog: readonly AssetDefinition[] = Object.values(assets);

/** Animals living on the habitat's surfaces, simulated by the ecosystem.
 * Fish swim separately. */
export function isLandAnimal(kind: AssetKind): boolean {
  return assets[kind].behavior !== undefined;
}
export function plantPerches(object: HabitatObject) {
  return assets[object.kind].perches?.(randomFromSeed(object.seed)) ?? [];
}

export function objectDens(object: HabitatObject) {
  return assets[object.kind].dens?.(randomFromSeed(object.seed)) ?? [];
}

export function buildAsset(kind: AssetKind, seed = 1): THREE.Group {
  const asset = assets[kind];
  const model = asset.build(randomFromSeed(seed));
  return asset.category === "Animals" ? model : batchStaticAsset(model);
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
