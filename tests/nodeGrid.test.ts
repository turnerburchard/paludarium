import { expect, it } from "vitest";
import { HabitatNodeGrid } from "../src/simulation/nodeGrid";
import { distance } from "../src/simulation/navigation";
import type { HabitatNode } from "../src/simulation/types";

it("finds the same nearby nodes in graph order across cell boundaries", () => {
  const nodes: HabitatNode[] = [];
  for (let x = -6; x <= 6; x++)
    for (let z = -6; z <= 6; z++)
      nodes.unshift({
        id: `${x}:${z}`,
        position: { x: x * 0.16, y: (x % 3) * 0.1, z: z * 0.16 },
        normal: { x: 0, y: 1, z: 0 },
        surface: "ground",
        wet: false,
        shelter: 0,
        neighbors: [],
      });
  for (const size of [0.16, 0.32, 0.65]) {
    const grid = new HabitatNodeGrid(nodes, size);
    for (const position of [
      { x: -0.32, y: 0, z: -0.16 },
      { x: 0, y: 0, z: 0 },
      { x: 0.65, y: 0.1, z: 0.32 },
    ])
      for (const range of [0, 0.16, 0.65, 2])
        expect(
          grid
            .near(position, range)
            .filter((node) => distance(node.position, position) <= range),
        ).toEqual(
          nodes.filter((node) => distance(node.position, position) <= range),
        );
  }
});
