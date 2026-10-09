import { it } from "vitest";
import { makePreset } from "../../src/model/presets";
import { randomFromSeed } from "../../src/model/random";
import { createWorldEcosystem } from "../../src/simulation/worldHabitat";
import { assets } from "../../src/assets";

it("probe", () => {
  for (const preset of ["aquarium", "tropical"] as const) for (const seed of [8, 1, 2]) {
    const world = makePreset(preset);
    const engine = createWorldEcosystem(world, undefined, randomFromSeed(seed));
    // eslint-disable-next-line
    const agents = [...(engine as any).agents.values()].filter((a: any) => a.swimmer);
    const stats = agents.map(() => ({ tangled: 0, turning: 0, turns: 0, flips: 0, longest: 0, run: 0 }));
    const prev = agents.map(() => 0);
    for (let t = 0; t < 120 * 30; t++) {
      engine.advance(1 / 30);
      agents.forEach((a: any, i: number) => {
        const s = stats[i], tt = a.swimmer.tightTurn; if (a.swimmer.curl) s.tangled += 1/30;
        if (tt) { s.turning += 1 / 30; s.run += 1 / 30; s.longest = Math.max(s.longest, s.run); } else s.run = 0;
        if (tt && !prev[i]) s.turns++;
        if (tt && prev[i] && tt !== prev[i]) s.flips++;
        prev[i] = tt;
      });
    }
    agents.forEach((a: any, i: number) => {
      const s = stats[i];
      console.log(preset, seed, world.objects.find((o) => o.id === a.swimmer.id)!.kind,
        `curled ${s.tangled.toFixed(1)}s turning ${s.turning.toFixed(1)}s in ${s.turns} turns, longest ${s.longest.toFixed(1)}s, flips ${s.flips}`);
    });
  }
}, 120_000);
