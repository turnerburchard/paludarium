import { describe, expect, it } from "vitest";
import { assets } from "../src/assets";
import { randomFromSeed } from "../src/model/random";
import {
  emptyWorld,
  AQUARIUM_WATER,
  type AssetKind,
  type HabitatObject,
} from "../src/model/schema";
import { newTerrain } from "../src/model/terrainData";
import { groundHeight, swimmingHeight } from "../src/model/terrain";
import {
  Steering,
  newSwimmer,
  type Fish,
  type SwimWater,
} from "../src/simulation/fish";
import { SwimSpace } from "../src/simulation/swimSpace";
import { createWorldEcosystem } from "../src/simulation/worldHabitat";

const object = (
  kind: AssetKind,
  x = 0,
  z = 0,
  extra: Partial<HabitatObject> = {},
): HabitatObject => ({
  id: kind,
  kind,
  x,
  z,
  scale: 1,
  rotation: 0,
  seed: 3,
  ...extra,
});
const tankEnvironment = {
  ...emptyWorld().environment,
  water: AQUARIUM_WATER,
  terrain: newTerrain(emptyWorld().environment, () => -0.9, "sand"),
};
const tank = (...objects: HabitatObject[]) => ({
  ...emptyWorld(),
  environment: tankEnvironment,
  objects,
});
/** Whether the fish fits at a spot, by default at its usual swimming height
 * there. */
const fits = (
  space: SwimSpace,
  o: HabitatObject,
  x: number,
  z: number,
  heading: number,
  wanted = swimmingHeight(x, z, tankEnvironment, assets[o.kind].swims!.depth),
) => {
  const y = space.steady(o.id, x, z, wanted).y;
  return space.canStart(o.id, x, y, z, heading);
};
/** A single fish swimming on its own, without a route. */
function swimAlone(space: SwimSpace, fish: Fish, random: () => number) {
  const steering = new Steering(space, random);
  const swimmer = newSwimmer(fish, random);
  return {
    advance: (seconds: number) =>
      steering.swim(swimmer, [swimmer], undefined, seconds),
    get: () => ({ ...swimmer }),
  };
}
const fishFor = (o: HabitatObject, space: SwimSpace): Fish => ({
  id: o.id,
  species: o.kind,
  speed: assets[o.kind].swims!.speed,
  x: o.x,
  y: space.steady(
    o.id,
    o.x,
    o.z,
    swimmingHeight(o.x, o.z, tankEnvironment, assets[o.kind].swims!.depth),
  ).y,
  z: o.z,
  heading: o.rotation,
});

describe("fish-sized water clearance", () => {
  it("keeps a fish clear of the floor in a terrain preview", () => {
    const world = tank(object("corydoras", 2, 0.7));
    const space = new SwimSpace(world);
    const preview = {
      ...world.environment,
      terrain: {
        ...world.environment.terrain!,
        heights: world.environment.terrain!.heights.map(() => 0.3),
      },
    };
    const committed = space.steady("corydoras", 2, 0.7, -10);
    const shown = space.steady("corydoras", 2, 0.7, -10, preview);
    expect(shown.y).toBeGreaterThan(committed.y);
    expect(shown.y).toBeGreaterThan(groundHeight(2, 0.7, preview) + 0.05);
  });

  it("rejects a retained swimming height below the floor", () => {
    const fish = object("convict-cichlid", 2, 0.7);
    const world = tank(fish);
    const space = new SwimSpace(world);
    const { y } = space.steady(fish.id, fish.x, fish.z, -10);
    expect(space.canSwim(fish.id, fish.x, y, fish.z, 0)).toBe(true);
    expect(space.canSwim(fish.id, fish.x, y - 0.05, fish.z, 0)).toBe(false);
  });

  it("blocks low fish at a stone while allowing fish to swim above it", () => {
    const low = object("rainbow-shark");
    const high = object("ember-tetra");
    const world = tank(object("rock"), low, high);
    const space = new SwimSpace(world);
    expect(fits(space, low, 0, 0, 0)).toBe(false);
    expect(fits(space, low, 0.7, 0, 0)).toBe(true);
    expect(fits(space, high, 0, 0, 0)).toBe(true);
    const y = swimmingHeight(0.7, 0, tankEnvironment, [0.3, 1]);
    expect(y).toBeGreaterThan(groundHeight(0.7, 0, world.environment) + 0.08);
  });

  it("leaves a hollow log's tunnel open and respects its rotation", () => {
    const small = object("corydoras");
    // On the bottom, where a corydoras roots through the sand.
    const low = (space: SwimSpace, x: number, z: number, heading: number) =>
      fits(space, small, x, z, heading, -Infinity);
    const space = new SwimSpace(tank(object("log"), small));
    expect(low(space, 0, 0, -Math.PI / 2)).toBe(true);
    expect(low(space, 0, 0.18, -Math.PI / 2)).toBe(false);
    expect(low(space, 0.45, 0.3, 0)).toBe(true);
    const rotated = new SwimSpace(
      tank(object("log", 0, 0, { rotation: Math.PI / 2 }), small),
    );
    expect(low(rotated, -0.18, 0, 0)).toBe(false);
    expect(low(rotated, 0, 0, 0)).toBe(true);
  });

  it("uses the actual gap between stones rather than their catalog circles", () => {
    const small = object("corydoras");
    const big = object("rainbow-shark", 0, 0, { scale: 2 });
    const space = new SwimSpace(
      tank(
        object("rock", -0.65, 0, { id: "left" }),
        object("rock", 0.65, 0, { id: "right" }),
        small,
        big,
      ),
    );
    expect(fits(space, small, 0, 0, 0)).toBe(true);
    expect(fits(space, big, 0, 0, 0)).toBe(false);
  });

  it("honors lifted hardscape and full body clearance at the glass", () => {
    const low = object("corydoras");
    expect(
      fits(
        new SwimSpace(tank(object("rock", 0, 0, { lift: 0.7 }), low)),
        low,
        0,
        0,
        0,
      ),
    ).toBe(true);
    const space = new SwimSpace(tank(low));
    const y = (x: number) => space.steady(low.id, x, 0, 0).y;
    expect(space.canSwim(low.id, 3.48, y(3.48), 0, Math.PI / 2)).toBe(false);
    expect(space.canSwim(low.id, 3.2, y(3.2), 0, Math.PI / 2)).toBe(true);
  });

  it("avoids submerged stems and leaves without blocking water above a plant", () => {
    const low = object("corydoras");
    const high = object("cardinal-tetra");
    const space = new SwimSpace(tank(object("rotala"), low, high));
    expect(fits(space, low, 0, 0, 0)).toBe(false);
    expect(fits(space, low, 0.5, 0, 0)).toBe(true);
    expect(fits(space, high, 0, 0, 0)).toBe(true);
  });

  it("relocates a fish enclosed by an edit, preserving everyone else's position", () => {
    const low = object("rainbow-shark", 0, 0);
    const other = object("corydoras", 2, 0);
    const world = tank(low, other);
    const engine = createWorldEcosystem(world);
    const edited = { ...world, objects: [...world.objects, object("rock")] };
    const next = createWorldEcosystem(edited, { world, engine });
    const moved = next.swimmer(low.id)!;
    expect(Math.hypot(moved.x, moved.z)).toBeGreaterThan(0.3);
    expect(
      new SwimSpace(edited).canStart(
        low.id,
        moved.x,
        moved.y,
        moved.z,
        moved.heading,
      ),
    ).toBe(true);
    expect(next.swimmer(other.id)).toEqual(engine.swimmer(other.id));
    expect(edited.objects.find((o) => o.id === low.id)).toEqual(low);
  });

  it("turns an edited fish at its live location", () => {
    const placed = object("corydoras", 2, 0.7);
    const world = tank(placed);
    const engine = createWorldEcosystem(world, undefined, () => 0.5);
    for (let tick = 0; tick < 100; tick++) engine.advance(0.1);
    const before = engine.swimmer(placed.id)!;
    const edited = {
      ...world,
      objects: [{ ...placed, rotation: Math.PI / 2 }],
    };
    const after = createWorldEcosystem(edited, { world, engine }).swimmer(
      placed.id,
    )!;
    expect(after.x).toBe(before.x);
    expect(after.z).toBe(before.z);
    expect(after.heading).toBeCloseTo(before.heading + Math.PI / 2);
  });
});

describe("obstacle-aware swimming", () => {
  it.each([0, Math.PI / 2, 1.1])(
    "steers a bottom fish around a stone at heading %s without freezing",
    (heading) => {
      const start = object(
        "rainbow-shark",
        Math.sin(heading) * 1.1,
        Math.cos(heading) * 1.1,
        { rotation: heading },
      );
      const space = new SwimSpace(tank(object("rock"), start));
      const fish = swimAlone(space, fishFor(start, space), randomFromSeed(5));
      let distance = 0,
        blocked = 0,
        rapidTurns = 0,
        lastFlip = -Infinity,
        side = 0;
      for (let i = 0; i < 20 * 30; i++) {
        const before = fish.get();
        fish.advance(1 / 30);
        const after = fish.get();
        expect(
          space.canStart(start.id, after.x, after.y, after.z, after.heading),
        ).toBe(true);
        const traveled = Math.hypot(after.x - before.x, after.z - before.z);
        distance += traveled;
        if (traveled === 0) blocked++;
        const turn = after.heading - before.heading;
        if (Math.abs(turn) > 0.025) {
          if (side && Math.sign(turn) !== side) {
            if (i - lastFlip < 8) rapidTurns++;
            lastFlip = i;
          }
          side = Math.sign(turn);
        }
        expect(Math.abs(turn)).toBeLessThanOrEqual(2.2 / 30 + 1e-8);
      }
      expect(distance).toBeGreaterThan(3);
      expect(blocked).toBeLessThanOrEqual(30);
      expect(rapidTurns).toBeLessThan(3);
    },
  );

  it("swims through a real narrow passage instead of detouring around it", () => {
    const start = object("corydoras", 0, 0.8);
    const space = new SwimSpace(
      tank(
        object("rock", -0.65, 0, { id: "left" }),
        object("rock", 0.65, 0, { id: "right" }),
        start,
      ),
    );
    const fish = swimAlone(space, fishFor(start, space), () => 0.5);
    for (let i = 0; i < 14 * 30; i++) {
      fish.advance(1 / 30);
      const after = fish.get();
      expect(
        space.canStart(start.id, after.x, after.y, after.z, after.heading),
      ).toBe(true);
      expect(Math.abs(after.x)).toBeLessThan(0.06);
    }
    expect(fish.get().z).toBeLessThan(-0.6);
  });

  it("sweeps movement so even a fast fish cannot tunnel through a thin obstacle", () => {
    const water: SwimWater = {
      steady: (_id, _x, _z, wanted) => ({ y: wanted, bob: 0 }),
      canSwim: (_id, x, _y, z) => Math.abs(z) > 0.006 || Math.abs(x) > 0.5,
    };
    const steering = new Steering(water, () => 0.5);
    const fish = newSwimmer(
      {
        id: "fast",
        species: "fast",
        speed: 3,
        x: 0,
        y: 0,
        z: 0.07,
        heading: 0,
      },
      () => 0.5,
    );
    for (let i = 0; i < 30; i++) {
      const before = { ...fish };
      steering.swim(fish, [fish], undefined, 0.1);
      if (before.z * fish.z < 0) {
        const t = before.z / (before.z - fish.z);
        expect(Math.abs(before.x + (fish.x - before.x) * t)).toBeGreaterThan(
          0.5,
        );
      }
    }
  });
});
