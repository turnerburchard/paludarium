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
