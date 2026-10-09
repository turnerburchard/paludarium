import { it } from "vitest";
import { makePreset } from "../../src/model/presets";
import { randomFromSeed } from "../../src/model/random";
import { createWorldEcosystem } from "../../src/simulation/worldHabitat";
import { assets } from "../../src/assets";

it("stuck", () => {
  let windows = 0, stuck = 0;
  for (const preset of ["aquarium", "tropical", "mountain", "grotto", "desert", "island"] as const)
    for (const seed of [1, 2, 3, 4, 5]) {
      const world = makePreset(preset);
      const engine = createWorldEcosystem(world, undefined, randomFromSeed(seed));
      const fish = world.objects.filter((o) => assets[o.kind].swims).map((o) => ({ o, s: engine.observeAnimal(o.id)! }));
      for (let w = 0; w < 20; w++) {
        const start = fish.map(({ s }) => ({ ...s.position }));
        const far = fish.map(() => 0);
        for (let t = 0; t < 6 * 30; t++) {
          engine.advance(1 / 30);
          fish.forEach(({ s }, i) => (far[i] = Math.max(far[i], Math.hypot(s.position.x - start[i].x, s.position.z - start[i].z))));
        }
        fish.forEach(({ o }, i) => { windows++; if (far[i] < 0.25) { stuck++; console.log("STUCK", preset, seed, o.kind, w); } });
      }
    }
  console.log("SUMMARY windows", windows, "stuck", stuck);
}, 600_000);
