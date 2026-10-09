import { describe, expect, it } from "vitest";
import {
  emptyWorld,
  type HabitatObject,
  type World,
} from "../src/model/schema";
import {
  buildHabitat,
  createWorldEcosystem,
} from "../src/simulation/worldHabitat";

const frog: HabitatObject = {
  id: "frog",
  kind: "tree-frog",
  x: -1,
  z: 0,
  rotation: 0,
  scale: 1,
  seed: 173,
};
function habitat(): World {
  return {
    ...emptyWorld(),
    environment: { ...emptyWorld().environment, water: 0 },
    objects: [
      { ...frog, id: "stone", kind: "rock", x: 1 },
      { ...frog, id: "plant", kind: "fern", x: 0 },
      frog,
      { ...frog, id: "other-frog", x: -2 },
      { ...frog, id: "fish", kind: "fish" },
    ],
  };
}

describe("reusing habitat navigation", () => {
  it.each([
    ["rename", (world: World) => ({ ...world, name: "Renamed" })],
    [
      "animal movement",
      (world: World) => ({
        ...world,
        objects: world.objects.map((o) =>
          o.id === frog.id ? { ...o, x: -2, rotation: 1 } : o,
        ),
      }),
    ],
    [
      "adding another fish",
      (world: World) => ({
        ...world,
        objects: [
          ...world.objects,
          { ...frog, id: "other-fish", kind: "fish" as const },
        ],
      }),
    ],
    [
      "removing an animal",
      (world: World) => ({
        ...world,
        objects: world.objects.filter((o) => o.id !== frog.id),
      }),
    ],
  ])("reuses unchanged surfaces after %s", (_, edit) => {
    const world = habitat();
    const engine = createWorldEcosystem(world);
    const next = edit(world);
    const updated = createWorldEcosystem(next, { world, engine });
    expect(updated.graph === engine.graph).toBe(true);
    expect([...updated.graph.nodes]).toEqual([...buildHabitat(next).nodes]);
    expect(updated.snapshot().animals.map((a) => a.id)).toEqual(
      next.objects.filter((o) => o.kind === "tree-frog").map((o) => o.id),
    );
  });

  it.each([
    [
      "removing the last fish",
      (world: World) => ({
        ...world,
        objects: world.objects.filter((o) => o.kind !== "fish"),
      }),
    ],
    [
      "removing the last large footprint",
      (world: World) => ({
        ...world,
        objects: world.objects.filter((o) => o.kind !== "tree-frog"),
      }),
    ],
    [
      "larger animal footprint",
      (world: World) => ({
        ...world,
        objects: world.objects.map((o) =>
          o.id === frog.id ? { ...o, scale: 5 } : o,
        ),
      }),
    ],
    [
      "terrain settings",
      (world: World) => ({
        ...world,
        environment: { ...world.environment, substrate: 0.5 },
      }),
    ],
    [
      "stone movement",
      (world: World) => ({
        ...world,
        objects: world.objects.map((o) =>
          o.id === "stone" ? { ...o, x: 0.5, rotation: 1 } : o,
        ),
      }),
    ],
    [
      "plant removal",
      (world: World) => ({
        ...world,
        objects: world.objects.filter((o) => o.id !== "plant"),
      }),
    ],
    [
      "moss cover",
      (world: World) => ({
        ...world,
        objects: world.objects.map((o) =>
          o.id === "stone" ? { ...o, moss: "sheet" as const } : o,
        ),
      }),
    ],
  ])("rebuilds surfaces after %s", (_, edit) => {
    const world = habitat();
    const engine = createWorldEcosystem(world);
    const next = edit(world);
    const updated = createWorldEcosystem(next, { world, engine });
    expect(updated.graph === engine.graph).toBe(false);
    expect([...updated.graph.nodes]).toEqual([...buildHabitat(next).nodes]);
  });
});
