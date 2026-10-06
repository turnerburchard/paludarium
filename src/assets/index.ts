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
import { anthurium } from "./plants/anthurium";
import { bromeliad } from "./plants/bromeliad";
import { fern } from "./plants/fern";
import { grass } from "./plants/grass";
import { monstera } from "./plants/monstera";
import { strawberry } from "./plants/strawberry";
import { moss } from "./landscape/moss";
import { rock } from "./landscape/rock";
import { wood } from "./landscape/wood";

export type { AssetDefinition, Category, FrogBehavior } from "./types";

/** Every placeable thing, in the order the library shows them. */
export const assets = {
  "tree-frog": treeFrog,
  "dart-frog": strawberryPoisonFrog,
  "blue-dart-frog": bluePoisonDartFrog,
  "mossy-frog": mossyFrog,
  monstera,
  fern,
  strawberry,
  bromeliad,
  anthurium,
  grass,
  moss,
  rock,
  wood,
  fish,
} satisfies Record<AssetKind, AssetDefinition>;

export const catalog: readonly AssetDefinition[] = Object.values(assets);

export function isFrog(kind: AssetKind): boolean {
  return assets[kind].frog !== undefined;
}
export function plantPerches(object: HabitatObject) {
  return assets[object.kind].perches?.(randomFromSeed(object.seed)) ?? [];
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
