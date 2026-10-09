import { it } from "vitest";
import { makePreset } from "../../src/model/presets";
import { randomFromSeed } from "../../src/model/random";
import { createWorldEcosystem } from "../../src/simulation/worldHabitat";
import { SwimSpace } from "../../src/simulation/swimSpace";

const [preset, seed, kind] = (process.env.CASE ?? "mountain,4,cutthroat-trout").split(",");
it("trace", () => {
  const world = makePreset(preset as any);
  const engine = createWorldEcosystem(world, undefined, randomFromSeed(Number(seed)));
  const space = new SwimSpace(world);
  const agents = [...(engine as any).agents.values()].filter((a: any) => a.swimmer && world.objects.find((o) => o.id === a.swimmer.id)!.kind === kind);
  for (let t = 0; t < 120 * 30; t++) {
    engine.advance(1 / 30);
    if (t % 300 === 0) for (const a of agents) {
      const f = a.swimmer;
      console.log(t, f.id.slice(0, 6), f.x.toFixed(2), f.y.toFixed(2), f.z.toFixed(2), f.heading.toFixed(2), "turn", f.tightTurn, "curl", f.curl, "avoid", f.avoidHeading?.toFixed(2), "path", a.path.length, a.state.activity, "reach", space.reach(f.id).toFixed(2), "straightOK", Array.from({ length: 12 }, (_, k) => +space.canSwim(f.id, f.x, f.y, f.z, k * Math.PI / 6)).join(""), "curledOK", Array.from({ length: 12 }, (_, k) => +space.canSwim(f.id, f.x, f.y, f.z, k * Math.PI / 6, { curled: true })).join(""), "steady", JSON.stringify(space.steady(f.id, f.x, f.z, f.y)), "floor", space.steady(f.id, f.x, f.z, -9).y.toFixed(3), "ceil", space.steady(f.id, f.x, f.z, 9).y.toFixed(3), "water", world.environment.water, "W", world.environment.width, world.environment.depth);
      if (t === 1800) for (const o of world.objects) { const d = Math.hypot(o.x - f.x, o.z - f.z); if (d < 0.8 && o.id !== f.id) console.log("   near", o.kind, d.toFixed(2), (o as any).scale); }
    }
  }
}, 600_000);
