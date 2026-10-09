import { it } from "vitest";
import { makePreset } from "../../src/model/presets";
import { randomFromSeed } from "../../src/model/random";
import { createWorldEcosystem } from "../../src/simulation/worldHabitat";
import { SwimSpace } from "../../src/simulation/swimSpace";
import { assets } from "../../src/assets";

it("pin", () => {
  const world = makePreset("island");
  const engine = createWorldEcosystem(world, undefined, randomFromSeed(1));
  const space = new SwimSpace(world);
  const agents = [...(engine as any).agents.values()].filter((a: any) => a.swimmer && world.objects.find((o) => o.id === a.swimmer.id)!.kind === "cardinal-tetra");
  const hist = new Map<any, any[]>();
  for (let t = 0; t < 620; t++) {
    engine.advance(1 / 30);
    for (const a of agents) { const f = a.swimmer; const h = hist.get(f) ?? []; h.push({ t, x: f.x.toFixed(3), y: f.y.toFixed(3), z: f.z.toFixed(3), h: f.heading.toFixed(2), turn: f.tightTurn, curl: f.curl }); hist.set(f, h.slice(-400)); }
  }
  for (const a of agents) {
    const f = a.swimmer; if (f.x < 3.4) continue;
    const h = hist.get(f)!; const first = h.findIndex((s: any) => s.turn !== 0 && h.slice(h.indexOf(s)).every((q: any) => q.turn !== 0));
    console.log(f.id.slice(0, 6), "stuck from", h[first]?.t, JSON.stringify(h.slice(Math.max(0, first - 12), first + 3)));
    const fw = { x: -Math.sin(f.heading), z: -Math.cos(f.heading) };
    console.log("back", [0.01, 0.02, 0.05, 0.1].map((d) => [+space.canSwim(f.id, f.x - fw.x * d, f.y, f.z - fw.z * d, f.heading), +space.canSwim(f.id, f.x - fw.x * d, f.y, f.z - fw.z * d, f.heading, { curled: true })].join("")).join(" "));
    const box = (space as any).bodies.get(f.id); console.log("body", JSON.stringify(box));
    for (const o of world.objects) if (assets[o.kind].hardscape && Math.hypot(o.x - f.x, o.z - f.z) < 2.5) console.log(" hard", o.kind, o.x.toFixed(2), o.z.toFixed(2), Math.hypot(o.x - f.x, o.z - f.z).toFixed(2));
  }
}, 600_000);
