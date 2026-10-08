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
import { groundHeight } from "../src/model/terrain";
import { FishSchool, type Fish } from "../src/simulation/fish";
import { SwimSpace } from "../src/simulation/swimSpace";
import { createFishSchool } from "../src/simulation/worldHabitat";

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
const tank = (...objects: HabitatObject[]) => ({
  ...emptyWorld(),
  environment: {
    ...emptyWorld().environment,
    water: AQUARIUM_WATER,
    terrain: newTerrain(emptyWorld().environment, () => -0.9, "sand"),
  },
  objects,
});
const swimmer = (o: HabitatObject): Fish => ({
  id: o.id,
  species: o.kind,
  speed: assets[o.kind].swims!.speed,
  x: o.x,
  z: o.z,
  heading: o.rotation,
});

describe("fish-sized water clearance", () => {
  it("follows terrain previews without moving or changing the committed school", () => {
    const world = tank(object("corydoras", 2, 0.7));
    const school = createFishSchool(world);
    const before = school.get("corydoras")!;
    const preview = {
      ...world.environment,
      terrain: {
        ...world.environment.terrain!,
        heights: world.environment.terrain!.heights.map(() => 0.3),
      },
    };
    const shown = school.get("corydoras", preview)!;
    expect(shown.y).toBeGreaterThan(before.y!);
    expect(shown.y).toBeGreaterThan(
      groundHeight(shown.x, shown.z, preview) + 0.05,
    );
    expect(shown.x).toBe(before.x);
    expect(shown.z).toBe(before.z);
    expect(school.get("corydoras")).toEqual(before);
  });

  it("blocks low fish at a stone while allowing fish to swim above it", () => {
    const low = object("rainbow-shark");
    const high = object("ember-tetra");
    const world = tank(object("rock"), low, high);
    const space = new SwimSpace(world);
    expect(space.canStart(swimmer(low), 0, 0, 0)).toBe(false);
    expect(space.canStart(swimmer(low), 0.7, 0, 0)).toBe(true);
    expect(space.canStart(swimmer(high), 0, 0, 0)).toBe(true);
    expect(space.height(swimmer(low), 0.7, 0)).toBeGreaterThan(
      groundHeight(0.7, 0, world.environment) + 0.08,
    );
  });

  it("leaves a hollow log's tunnel open and respects its rotation", () => {
    const small = object("corydoras");
    const space = new SwimSpace(tank(object("log"), small));
    const fish = swimmer(small);
    expect(space.canStart(fish, 0, 0, -Math.PI / 2)).toBe(true);
    expect(space.canStart(fish, 0, 0.18, -Math.PI / 2)).toBe(false);
    expect(space.canStart(fish, 0.45, 0.3, 0)).toBe(true);
    const rotated = new SwimSpace(
      tank(object("log", 0, 0, { rotation: Math.PI / 2 }), small),
    );
    expect(rotated.canStart(fish, -0.18, 0, 0)).toBe(false);
    expect(rotated.canStart(fish, 0, 0, 0)).toBe(true);
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
    expect(space.canStart(swimmer(small), 0, 0, 0)).toBe(true);
    expect(space.canStart(swimmer(big), 0, 0, 0)).toBe(false);
  });

  it("honors lifted hardscape and full body clearance at the glass", () => {
    const low = object("corydoras");
    const fish = swimmer(low);
    expect(
      new SwimSpace(tank(object("rock", 0, 0, { lift: 0.7 }), low)).canStart(
        fish,
        0,
        0,
        0,
      ),
    ).toBe(true);
    const space = new SwimSpace(tank(low));
    expect(space.canSwim(fish, 3.48, 0, Math.PI / 2)).toBe(false);
    expect(space.canSwim(fish, 3.2, 0, Math.PI / 2)).toBe(true);
  });

  it("avoids submerged stems and leaves without blocking water above a plant", () => {
    const low = object("corydoras");
    const high = object("cardinal-tetra");
    const space = new SwimSpace(tank(object("rotala"), low, high));
    expect(space.canStart(swimmer(low), 0, 0, 0)).toBe(false);
    expect(space.canStart(swimmer(low), 0.5, 0, 0)).toBe(true);
    expect(space.canStart(swimmer(high), 0, 0, 0)).toBe(true);
  });

  it("relocates a fish enclosed by an edit, preserving everyone else's position", () => {
    const low = object("rainbow-shark", 0, 0);
    const other = object("corydoras", 2, 0);
    const world = tank(low, other);
    const school = createFishSchool(world);
    const edited = { ...world, objects: [...world.objects, object("rock")] };
    const next = createFishSchool(edited, { world, fish: school });
    const moved = next.get(low.id)!;
    expect(Math.hypot(moved.x, moved.z)).toBeGreaterThan(0.3);
    expect(
      new SwimSpace(edited).canStart(moved, moved.x, moved.z, moved.heading),
    ).toBe(true);
    expect(next.get(other.id)).toEqual(school.get(other.id));
    expect(edited.objects.find((o) => o.id === low.id)).toEqual(low);
  });

  it("turns an edited fish at its live location", () => {
    const placed = object("corydoras", 2, 0.7);
    const world = tank(placed);
    const school = createFishSchool(world, undefined, () => 0.5);
    for (let tick = 0; tick < 100; tick++) school.advance(0.1);
    const before = school.get(placed.id)!;
    const edited = {
      ...world,
      objects: [{ ...placed, rotation: Math.PI / 2 }],
    };
    const after = createFishSchool(edited, { world, fish: school }).get(
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
      const world = tank(object("rock"), start);
      const space = new SwimSpace(world);
      const fish = swimmer(start);
      const school = new FishSchool([fish], () => true, {
        random: randomFromSeed(5),
        canSwim: space.canSwim,
      });
      let distance = 0,
        blocked = 0,
        rapidTurns = 0,
        lastFlip = -Infinity,
        side = 0;
      for (let i = 0; i < 20 * 30; i++) {
        const before = school.get(fish.id)!;
        school.advance(1 / 30);
        const after = school.get(fish.id)!;
        expect(space.canStart(after, after.x, after.z, after.heading)).toBe(
          true,
        );
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
    const world = tank(
      object("rock", -0.65, 0, { id: "left" }),
      object("rock", 0.65, 0, { id: "right" }),
      start,
    );
    const space = new SwimSpace(world);
    const fish = swimmer(start);
    const school = new FishSchool([fish], () => true, {
      random: () => 0.5,
      canSwim: space.canSwim,
    });
    for (let i = 0; i < 14 * 30; i++) {
      school.advance(1 / 30);
      const after = school.get(fish.id)!;
      expect(space.canStart(after, after.x, after.z, after.heading)).toBe(true);
      expect(Math.abs(after.x)).toBeLessThan(0.06);
    }
    expect(school.get(fish.id)!.z).toBeLessThan(-0.6);
  });

  it("sweeps movement so even a fast fish cannot tunnel through a thin obstacle", () => {
    const fish: Fish = {
      id: "fast",
      species: "fast",
      speed: 3,
      x: 0,
      z: 0.07,
      heading: 0,
    };
    const school = new FishSchool([fish], () => true, {
      random: () => 0.5,
      canSwim: (_, x, z) => Math.abs(z) > 0.006 || Math.abs(x) > 0.5,
    });
    for (let i = 0; i < 30; i++) {
      const before = school.get(fish.id)!;
      school.advance(0.1);
      const after = school.get(fish.id)!;
      if (before.z * after.z < 0) {
        const t = before.z / (before.z - after.z);
        expect(Math.abs(before.x + (after.x - before.x) * t)).toBeGreaterThan(
          0.5,
        );
      }
    }
  });
});
