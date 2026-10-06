import * as THREE from "three";
import type { AssetKind } from "../model/schema";
import { randomFromSeed } from "../model/random";
import type { AssetDefinition } from "./types";
import {
  bluePoisonDartFrog,
  mossyFrog,
  strawberryPoisonFrog,
  treeFrog,
} from "./animals/frogs";
import { fish } from "./animals/fish";
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

export function buildAsset(kind: AssetKind, seed = 1): THREE.Group {
  return assets[kind].build(randomFromSeed(seed));
}

export function disposeAsset(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
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
