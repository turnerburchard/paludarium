import { describe, expect, it } from "vitest";
import { defaultEnvironment, type HabitatObject } from "../src/model/schema";
import { objectBase, replaceObject } from "../src/model/stacking";

const env = { ...defaultEnvironment, water: 0 };
const object = (
  id: string,
  x: number,
  z: number,
  rest?: Partial<HabitatObject>,
): HabitatObject => ({
  id,
  kind: "rock",
  x,
  z,
  rotation: 0,
  scale: 1,
  seed: 1,
  ...rest,
});
const rock = object("rock", -1, 0);
const fern = object("fern", -0.9, 0, {
  kind: "fern",
  support: "rock",
  lift: 0.4,
});
const pebble = object("pebble", -1, 0, { support: "rock", lift: 0.42 });
const moss = object("moss", -1, 0, {
  kind: "moss",
  support: "pebble",
  lift: 0.7,
});
const world = [rock, fern, pebble, moss];
const above = (child: HabitatObject, support: HabitatObject) =>
  objectBase(child, env) - objectBase(support, env);
const find = (objects: HabitatObject[], id: string) =>
  objects.find((o) => o.id === id)!;

describe("stacked objects", () => {
  it("follow their support when it moves, keeping their height on it", () => {
    const moved = replaceObject(world, env, "rock", { ...rock, x: 0.5, z: 1 });
    const carried = find(moved, "fern");
    expect(carried.x).toBeCloseTo(0.6);
    expect(carried.z).toBeCloseTo(1);
    expect(above(carried, find(moved, "rock"))).toBeCloseTo(above(fern, rock));
    // What rests on a carried stone comes along too.
    expect(find(moved, "moss").x).toBeCloseTo(0.5);
    expect(above(find(moved, "moss"), find(moved, "rock"))).toBeCloseTo(
      above(moss, rock),
    );
  });

  it("turn around their support and rise with it as it grows", () => {
    const turned = replaceObject(world, env, "rock", {
      ...rock,
      rotation: Math.PI / 2,
      scale: 2,
    });
    const carried = find(turned, "fern");
    // A quarter turn about +y takes a point at +x to -z, as Three.js does.
    expect(carried.x).toBeCloseTo(-1);
    expect(carried.z).toBeCloseTo(-0.2);
    expect(carried.rotation).toBeCloseTo(Math.PI / 2);
    expect(above(carried, rock)).toBeCloseTo(above(fern, rock) * 2);
  });

  it("settle to the ground when their support is removed", () => {
    const removed = replaceObject(world, env, "rock");
    expect(removed.map((o) => o.id)).toEqual(["fern", "pebble", "moss"]);
    expect(find(removed, "fern")).toEqual({
      ...fern,
      lift: undefined,
      support: undefined,
    });
    expect(above(find(removed, "moss"), find(removed, "pebble"))).toBeCloseTo(
      above(moss, pebble),
    );
  });

  it("stop carrying when supports loop back on each other", () => {
    const a = object("a", 0, 0, { support: "b", lift: 0.2 });
    const b = object("b", 0.1, 0, { support: "a", lift: 0.2 });
    const moved = replaceObject([a, b], env, "a", { ...a, x: 0.5 });
    expect(find(moved, "b").x).toBeCloseTo(0.6);
  });
});
