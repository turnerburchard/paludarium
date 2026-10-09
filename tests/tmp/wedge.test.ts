import { it } from "vitest";
import { makePreset } from "../../src/model/presets";
import { randomFromSeed } from "../../src/model/random";
import { createWorldEcosystem } from "../../src/simulation/worldHabitat";
import { SwimSpace } from "../../src/simulation/swimSpace";

it("wedge", () => {
  const world = makePreset("aquarium");
  const engine = createWorldEcosystem(world, undefined, randomFromSeed(8));
  const space = new SwimSpace(world);
  const agents = [...(engine as any).agents.values()].filter((a: any) => a.swimmer);
  let run = new Map<any, number>();
  for (let t = 0; t < 120 * 30; t++) {
    const before = agents.map((a: any) => ({ ...a.swimmer }));
    engine.advance(1 / 30);
    agents.forEach((a: any, i: number) => {
      const f = a.swimmer;
      const r = f.tightTurn ? (run.get(f) ?? 0) + 1 : 0;
      run.set(f, r);
      if (r === 1 || (r > 0 && r % 150 === 0 && r < 800)) {
        const b = before[i];
        const ok = (dh: number, y = f.y) => space.canSwim(f.id, f.x, y, f.z, f.heading + dh);
        console.log(t, f.id.slice(0, 8), world.objects.find(o => o.id === f.id)!.kind,
          JSON.stringify({ x: f.x.toFixed(3), y: f.y.toFixed(3), z: f.z.toFixed(3), h: f.heading.toFixed(2), reach: space.reach(f.id).toFixed(3) }),
          "here", ok(0), "±.05", ok(0.05), ok(-0.05), "±.3", ok(0.3), ok(-0.3), "up", ok(0.05, f.y + 0.02), ok(-0.05, f.y + 0.02), "down", ok(0.05, f.y - 0.02), ok(-0.05, f.y - 0.02),
          "steady", space.steady(f.id, f.x, f.z, f.y).y.toFixed(3), "route", (engine as any).steering.route(f, f.heading, space.reach(f.id)*2, 0.55).toFixed(3), "routes", Array.from({length: 12}, (_, k) => (engine as any).steering.route({...f, heading: k*Math.PI/6, turnRate: 0}, k*Math.PI/6, space.reach(f.id)*2, 0.55).toFixed(2)).join(","), "bentOK", Array.from({length: 12}, (_, k) => +space.canSwim(f.id, f.x, f.y, f.z, k*Math.PI/6, 0, true)).join(""), "straightOK", Array.from({length: 12}, (_, k) => +space.canSwim(f.id, f.x, f.y, f.z, k*Math.PI/6)).join(""), "shift", [[0.02,0],[-0.02,0],[0,0.02],[0,-0.02]].map(([dx,dz]) => +space.canSwim(f.id, f.x+dx, f.y, f.z+dz, f.heading, 0, true)).join(""), "env", world.environment.width, world.environment.depth, "water", world.environment.water);
      }
    });
  }
}, 120_000);
