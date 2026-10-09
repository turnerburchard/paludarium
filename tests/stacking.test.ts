import { describe, expect, it } from "vitest";
import { Mesh, Vector3, type Object3D } from "three";
import { assets, buildAsset, catalog } from "../src/assets";
import {
  defaultEnvironment,
  emptyWorld,
  type HabitatObject,
} from "../src/model/schema";
import { objectBase, replaceObject } from "../src/model/stacking";
import { groundHeight } from "../src/model/terrain";
import { TerrainStroke } from "../src/editor/terrainStroke";
import { withEnvironment } from "../src/editor/useEditor";

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

describe("stacked objects when the ground changes", () => {
  it("stay on their support through a sculpting stroke", () => {
    const base = { ...emptyWorld(), environment: env };
    const stack = [
      object("rock", 1, 0, { scale: 1.5 }),
      {
        ...object("fern", 1.3, 0, { kind: "fern" }),
        support: "rock",
        lift: 0.3,
      },
    ];
    const stroke = new TerrainStroke(
      { ...base, objects: stack },
      { mode: "raise", radius: 0.5 },
    );
    stroke.dab(1.5, 0);
    const result = stroke.dab(1.7, 0);
    const height = (objects: HabitatObject[], e: typeof env) =>
      objectBase(find(objects, "fern"), e) -
      objectBase(find(objects, "rock"), e);
    expect(groundHeight(1.3, 0, result.environment)).not.toBeCloseTo(
      groundHeight(1, 0, result.environment),
    );
    expect(height(result.objects, result.environment)).toBeCloseTo(
      height(stack, env),
    );
    // Paint leaves every object where it is, so the simulation keeps running.
    const paint = new TerrainStroke(result, { mode: "sand", radius: 0.5 });
    paint.dab(1.5, 0);
    expect(paint.dab(1.7, 0).objects).toBe(result.objects);
  });
  it("move with their support when a smaller tank pulls it in", () => {
    const log = object("log", 3.2, 0, { kind: "log" });
    const fern = object("fern", 3.3, 0, {
      kind: "fern",
      support: "log",
      lift: 0.2,
    });
    const world = { ...emptyWorld(), environment: env, objects: [log, fern] };
    const smaller = withEnvironment(world, { width: 5 });
    const [newLog, newFern] = ["log", "fern"].map((id) =>
      find(smaller.objects, id),
    );
    expect(newLog.x).toBeLessThan(2.5);
    expect(newFern.x - newLog.x).toBeCloseTo(0.1);
    expect(
      objectBase(newFern, smaller.environment) -
        objectBase(newLog, smaller.environment),
    ).toBeCloseTo(objectBase(fern, env) - objectBase(log, env));
  });
});

describe("floating plants", () => {
  it("rest on the water's surface, not the bottom", () => {
    const pond = { ...defaultEnvironment, water: 0.44 };
    const lily = object("lily", 2.6, 0, { kind: "water-lily" });
    expect(groundHeight(2.6, 0, pond)).toBeLessThan(0.44);
    expect(objectBase(lily, pond)).toBe(0.44);
    expect(objectBase({ ...lily, kind: "anubias" }, pond)).toBe(
      groundHeight(2.6, 0, pond),
    );
  });
});

describe("long wood", () => {
  // Halfway down the bank, where the ground falls about 0.15 across a piece.
  const lying = catalog.filter((asset) => asset.groundPoints);

  it.each(lying.map((asset) => asset.kind))(
    "keeps every end of %s on a slope instead of floating",
    (kind) => {
      for (const rotation of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const piece = object("piece", 0.9, 0.3, { kind, rotation });
        const model = buildAsset(kind, piece.seed);
        model.position.set(piece.x, objectBase(piece, env), piece.z);
        model.rotation.y = rotation;
        model.updateMatrixWorld(true);
        const bark = vertices(model);
        for (const point of assets[kind].groundPoints!) {
          const end = new Vector3(point.x, 0, point.z).applyMatrix4(
            model.matrixWorld,
          );
          const lowest = Math.min(
            ...bark
              .filter((v) => Math.hypot(v.x - end.x, v.z - end.z) < 0.08)
              .map((v) => v.y),
          );
          expect(lowest).toBeLessThan(groundHeight(end.x, end.z, env));
        }
      }
    },
  );
});

function vertices(model: Object3D) {
  const points: Vector3[] = [];
  model.traverse((part) => {
    if (!(part instanceof Mesh)) return;
    const position = part.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++)
      points.push(
        new Vector3()
          .fromBufferAttribute(position, i)
          .applyMatrix4(part.matrixWorld),
      );
  });
  return points;
}
