import { it } from "vitest";
import { makePreset } from "../../src/model/presets";
import { randomFromSeed } from "../../src/model/random";
import { createWorldEcosystem } from "../../src/simulation/worldHabitat";
import { SwimSpace } from "../../src/simulation/swimSpace";
it("cory", () => {
  const world = makePreset("aquarium");
  const engine = createWorldEcosystem(world, undefined, randomFromSeed(1));
  const space = new SwimSpace(world);
  const agents = [...(engine as any).agents.values()].filter((a: any) => a.swimmer);
  const run = new Map<any, number>();
  for (let t = 0; t < 120 * 30; t++) {
    engine.advance(1 / 30);
    for (const a of agents) {
      const f = a.swimmer;
      const r = f.tightTurn ? (run.get(f) ?? 0) + 1 : 0;
      run.set(f, r);
      if (r === 1 || r === 90) {
        const c = (h: number, dx = 0, dz = 0, dy = 0, curled = true) => +space.canSwim(f.id, f.x + dx, f.y + dy, f.z + dz, h, { curled });
        console.log(t, world.objects.find(o => o.id === f.id)!.kind, f.x.toFixed(3), f.y.toFixed(3), f.z.toFixed(3), f.heading.toFixed(2),
          "curled@30deg", Array.from({ length: 12 }, (_, k) => c(k * Math.PI / 6)).join(""),
          "straight", Array.from({ length: 12 }, (_, k) => c(k * Math.PI / 6, 0, 0, 0, false)).join(""),
          "up.05", Array.from({ length: 12 }, (_, k) => c(k * Math.PI / 6, 0, 0, 0.05)).join(""),
          "floor", space.steady(f.id, f.x, f.z, -9).y.toFixed(3), "reach", space.reach(f.id).toFixed(3));
        for (const o of world.objects) { const d = Math.hypot(o.x - f.x, o.z - f.z); if (d < 0.6 && o.id !== f.id) console.log("   near", o.kind, d.toFixed(2)); }
      }
    }
  }
}, 120000);
