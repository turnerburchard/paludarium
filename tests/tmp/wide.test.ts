import { it } from "vitest";
import { makePreset } from "../../src/model/presets";
import { randomFromSeed } from "../../src/model/random";
import { createWorldEcosystem } from "../../src/simulation/worldHabitat";

it("wide", () => {
  let fishRuns = 0, turns = 0;
  for (const preset of ["aquarium", "tropical", "mountain", "grotto", "desert", "island"] as const)
    for (const seed of [1, 2, 3, 4, 5]) {
      const world = makePreset(preset);
      const engine = createWorldEcosystem(world, undefined, randomFromSeed(seed));
      const agents = [...(engine as any).agents.values()].filter((a: any) => a.swimmer);
      fishRuns += agents.length;
      const turn = agents.map(() => 0), curl = agents.map(() => 0), worst = agents.map(() => 0);
      for (let t = 0; t < 120 * 30; t++) {
        engine.advance(1 / 30);
        agents.forEach((a: any, i: number) => {
          const f = a.swimmer;
          if (f.tightTurn && !turn[i]) turns++;
          turn[i] = f.tightTurn ? turn[i] + 1 / 30 : 0;
          curl[i] = f.curl ? curl[i] + 1 / 30 : 0;
          worst[i] = Math.max(worst[i], turn[i], curl[i]);
        });
      }
      agents.forEach((a: any, i: number) => {
        if (worst[i] > 3) console.log("LONG", preset, seed, world.objects.find((o) => o.id === a.swimmer.id)!.kind, worst[i].toFixed(1));
      });
    }
  console.log("SUMMARY fish-runs", fishRuns, "tight turns", turns);
}, 600_000);
