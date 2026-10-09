import { test } from "vitest";
import { readFileSync } from "node:fs";
import { parseWorld } from "../src/editor/persistence";
import { waterMap } from "../src/model/water";
import { groundHeight } from "../src/model/terrain";
test("probe", () => {
  const env = parseWorld(readFileSync(".linkworld.json", "utf8")).environment;
  const m = waterMap(env);
  console.log("pools", m.pools.map((p) => ({ level: p.level, cells: p.cells.length })));
  for (const s of m.streams) {
    console.log("stream", s.length, s.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)} w${p.width.toFixed(2)} y${p.y?.toFixed?.(2) ?? ""} g${groundHeight(p.x, p.z, env).toFixed(2)}`).join(" | "));
  }
});
