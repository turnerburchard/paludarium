import * as THREE from "three";
import type { AssetKind } from "../model/schema";
import { randomFromSeed } from "../model/terrain";

import { monstera, fern, strawberry, bromeliad, grass } from "./assets/plants";
import { rock, moss, wood } from "./assets/landscape";
import { fish } from "./assets/animals";
import { frog } from "./assets/frogs";

export function buildAsset(kind: AssetKind, seed = 1): THREE.Group {
  const random = randomFromSeed(seed);
  switch (kind) {
    case "monstera":
      return monstera(random);
    case "fern":
      return fern(random);
    case "strawberry":
      return strawberry(random);
    case "bromeliad":
      return bromeliad(random);
    case "grass":
      return grass(random);
    case "moss":
      return moss(random);
    case "rock":
      return rock(random);
    case "wood":
      return wood();
    case "tree-frog":
    case "dart-frog":
    case "blue-dart-frog":
    case "mossy-frog":
      return frog(kind, random);
    case "fish":
      return fish();
  }
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
