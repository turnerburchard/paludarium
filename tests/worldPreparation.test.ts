import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import * as assets from "../src/assets";
import { emptyWorld } from "../src/model/schema";
import * as habitat from "../src/simulation/worldHabitat";
import { prepareWorld } from "../src/scene/prepareWorld";
import { finishWork } from "../src/work";

afterEach(() => vi.restoreAllMocks());

function setup() {
  const world = emptyWorld();
  world.objects = [0, 1].map((i) => ({
    id: `plant-${i}`,
    kind: "fern",
    x: i,
    z: 0,
    rotation: 0,
    scale: 1,
    seed: i + 1,
  }));
  const engine = habitat.createWorldEcosystem(emptyWorld());
  vi.spyOn(habitat, "createWorldEcosystemSteps").mockImplementation(
    function* () {
      return engine;
    },
  );
  const originalBuild = assets.buildAssetSteps;
  const models: THREE.Group[] = [];
  const build = vi
    .spyOn(assets, "buildAssetSteps")
    .mockImplementation(function* (...args) {
      const model = yield* originalBuild(...args);
      models.push(model);
      return model;
    });
  return { world, engine, build, models };
}

it("hands off completed models without disposing them", () => {
  const { world, engine, build, models } = setup();
  const dispose = vi.spyOn(assets, "disposeAsset");
  const prepared = finishWork(prepareWorld(world));
  expect(prepared.world).toBe(world);
  expect(prepared.engine).toBe(engine);
  expect([...prepared.models.keys()]).toEqual(
    world.objects.map((object) => object.id),
  );
  for (const [i, object] of world.objects.entries()) {
    expect(build).toHaveBeenNthCalledWith(
      i + 1,
      object.kind,
      object.seed,
      object.moss,
    );
    expect(prepared.models.get(object.id)).toBe(models[i]);
  }
  expect(dispose).not.toHaveBeenCalled();
  prepared.models.forEach(assets.disposeAsset);
});

it.each(["cancel", "fail"])(
  "releases an unfinished world's models on %s",
  (action) => {
    const { world, build, models } = setup();
    function* opening() {
      yield* prepareWorld(world);
    }
    const steps = opening();
    do {
      steps.next();
    } while (models.length < 1);
    expect(build).toHaveBeenCalledOnce();
    const model = models[0];
    const released = vi.fn();
    model.traverse((part) => {
      if (part instanceof THREE.Mesh)
        part.geometry.addEventListener("dispose", released);
    });
    if (action === "cancel") steps.return();
    else {
      const error = new Error("model failed");
      build.mockImplementationOnce(function* () {
        throw error;
      });
      expect(() => steps.next()).toThrow(error);
    }
    expect(released).toHaveBeenCalled();
  },
);
