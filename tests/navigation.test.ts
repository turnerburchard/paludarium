import { expect, it } from "vitest";
import { HabitatGraph } from "../src/simulation/navigation";
import type { HabitatNode, SpeciesProfile } from "../src/simulation/types";

it("keeps navigation independent of later edits to the source surfaces", () => {
  const start: HabitatNode = {
    id: "start",
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    surface: "ground",
    wet: false,
    shelter: 0,
    neighbors: ["finish"],
  };
  const finish: HabitatNode = {
    ...start,
    id: "finish",
    surface: "stone",
    position: { x: 1, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    neighbors: ["start"],
  };
  const graph = new HabitatGraph([start, finish]);
  start.neighbors.length = 0;
  finish.position.x = 100;
  finish.normal.y = 0;
  const species: SpeciesProfile = {
    id: "walker",
    nocturnal: false,
    climbs: false,
    speed: 1,
  };
  const routes = graph.routes("start", species);
  expect(routes.pathTo("finish")).toEqual(["finish"]);
  expect(routes.distances.get("finish")).toBe(1);
});

it("resumes weighted searches without changing routes or tie breaks", () => {
  const nodes: HabitatNode[] = Array.from({ length: 30 }, (_, i) => ({
    id: String(i),
    position: { x: i % 5, y: 0, z: Math.floor(i / 5) },
    normal: { x: 0, y: 1, z: 0 },
    surface: "ground",
    wet: false,
    shelter: 0,
    neighbors: [i - 5, i - 1, i + 1, i + 5]
      .filter((n) => n >= 0 && n < 30)
      .map(String),
  }));
  const graph = new HabitatGraph(nodes, (from, to) =>
    to.id === "6" ? Infinity : 1 + (Number(from.id) % 3),
  );
  const species = { id: "walker", nocturnal: false, climbs: false, speed: 1 };
  const expected = graph.routes("0", species);
  const search = graph.searchRoutes("0", species);
  let result = search.next();
  let batches = 0;
  while (!result.done) {
    batches++;
    result = search.next();
  }
  expect(batches).toBeGreaterThan(20);
  expect(result.value.distances).toEqual(expected.distances);
  expect(result.value.costs).toEqual(expected.costs);
  expect(result.value.firstSteps).toEqual(expected.firstSteps);
  for (const id of expected.distances.keys())
    expect(result.value.pathTo(id)).toEqual(expected.pathTo(id));
});
