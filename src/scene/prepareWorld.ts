import type * as THREE from "three";
import { buildAssetSteps, disposeAsset } from "../assets";
import type { World } from "../model/schema";
import type { Ecosystem } from "../simulation/engine";
import { createWorldEcosystemSteps } from "../simulation/worldHabitat";

export interface PreparedWorld {
  world: World;
  engine: Ecosystem;
  models: Map<string, THREE.Group>;
}

/** Until completion, cancellation owns every model made for this world. */
export function* prepareWorld(
  world: World,
  random?: () => number,
): Generator<void, PreparedWorld> {
  const models = new Map<string, THREE.Group>();
  let completed = false;
  try {
    const engine = yield* createWorldEcosystemSteps(world, undefined, random);
    for (const object of world.objects) {
      yield;
      models.set(
        object.id,
        yield* buildAssetSteps(object.kind, object.seed, object.moss),
      );
    }
    yield;
    completed = true;
    return { world, engine, models };
  } finally {
    if (!completed) models.forEach(disposeAsset);
  }
}
