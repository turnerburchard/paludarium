import { describe, expect, it } from "vitest";
import {
  CURLED_LENGTH,
  Steering,
  newSwimmer,
  type Fish,
  type SwimWater,
} from "../src/simulation/fish";
import { randomFromSeed } from "../src/model/random";
import { makePreset } from "../src/model/presets";
import { placementProblem } from "../src/model/water";
import { createWorldEcosystem } from "../src/simulation/worldHabitat";
import { SwimSpace } from "../src/simulation/swimSpace";
import { assets } from "../src/assets";
import type { World } from "../src/model/schema";
import type { AnimalState, Vec3 } from "../src/simulation/types";

/** A round pond of radius 1 centered on the origin, at any depth. */
const pond: SwimWater = {
  steady: (_id, _x, _z, wanted) => ({ y: wanted, bob: 0 }),
  canSwim: (_id, x, _y, z) => Math.hypot(x, z) < 1,
  reach: () => 0.1,
};
function school(fish: Fish[], water = pond, random = randomFromSeed(3)) {
  const steering = new Steering(water, random);
  const swimmers = fish.map((f) => newSwimmer(f, random));
  return {
    advance(seconds: number, goal?: Vec3) {
      for (const f of swimmers) steering.swim(f, swimmers, goal, seconds);
    },
    all: () =>
      swimmers.map(({ id, x, y, z, heading }) => ({ id, x, y, z, heading })),
    get: (id: string) => swimmers.find((f) => f.id === id)!,
    pitch: (id: string) => steering.pitch(swimmers.find((f) => f.id === id)!),
  };
}
type School = ReturnType<typeof school>;
const run = (s: School, seconds: number, goal?: Vec3) => {
  for (let i = 0; i < seconds * 30; i++) s.advance(1 / 30, goal);
};
const five = (): Fish[] =>
  [0, 1, 2, 3, 4].map((i) => ({
    id: `f${i}`,
    species: "fish",
    speed: 0.22,
    x: Math.cos(i) * 0.5,
    y: 0,
    z: Math.sin(i) * 0.5,
    heading: i,
  }));

describe("fish steering", () => {
  it("turns away from the shore instead of bumping into it", () => {
    const s = school(five());
    let frames = 0,
      blocked = 0;
    for (let i = 0; i < 120 * 30; i++) {
      const before = s.all();
      s.advance(1 / 30);
      s.all().forEach((f, n) => {
        frames++;
        if (f.x === before[n].x && f.z === before[n].z) blocked++;
      });
    }
    expect(blocked / frames).toBeLessThan(0.05);
  });

  it("keeps swimming instead of getting stuck at the shore", () => {
    const s = school(five());
    run(s, 10);
    const before = s.all();
    run(s, 10);
    s.all().forEach((f, i) =>
      expect(Math.hypot(f.x - before[i].x, f.z - before[i].z)).toBeGreaterThan(
        0.2,
      ),
    );
  });

  it("schools only with its own species", () => {
    // A lone fish heading one way beside four heading the other.
    const turnAfterASecond = (species: string) => {
      const s = school([
        { id: "lone", species, speed: 0.22, x: 0, y: 0, z: 0, heading: 0 },
        ...[0, 1, 2, 3].map((i) => ({
          id: `f${i}`,
          species: "tetra",
          speed: 0.22,
          x: Math.cos(i * 1.6) * 0.2,
          y: 0,
          z: Math.sin(i * 1.6) * 0.2,
          heading: Math.PI,
        })),
      ]);
      run(s, 1);
      return Math.abs(Math.sin(s.get("lone").heading / 2));
    };
    expect(turnAfterASecond("tetra")).toBeGreaterThan(
      turnAfterASecond("guppy") + 0.2,
    );
  });

  it("drift apart for a while instead of always schooling", () => {
    // A wide pool, so a roaming fish has room to leave the others. One school
    // swings anywhere from 10% to 90% apart, and which way depends on float
    // rounding that differs between CPUs, so judge several.
    const wide: SwimWater = {
      ...pond,
      canSwim: (_id, x, _y, z) => Math.hypot(x, z) < 3,
    };
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    let apart = 0;
    for (const seed of seeds) {
      const s = school(five(), wide, randomFromSeed(seed));
      for (let second = 0; second < 240; second++) {
        run(s, 1);
        const fish = s.all();
        if (
          fish.some((a) =>
            fish.every(
              (b) => a === b || Math.hypot(a.x - b.x, a.z - b.z) > 0.9,
            ),
          )
        )
          apart++;
      }
    }
    expect(apart / (240 * seeds.length)).toBeGreaterThan(0.15);
    expect(apart / (240 * seeds.length)).toBeLessThan(0.85);
  });

  it("keeps a little space between fish", () => {
    const s = school(five());
    run(s, 60);
    let crowded = 0;
    for (let second = 0; second < 60; second++) {
      run(s, 1);
      const fish = s.all();
      for (const a of fish)
        for (const b of fish)
          if (a !== b && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.08)
            crowded++;
    }
    expect(crowded).toBeLessThan(20);
  });

  it("keeps clear of other kinds of fish too", () => {
    // Two fish swimming head on at the same depth.
    const s = school([
      { ...five()[0], id: "a", species: "tetra", x: 0, z: 0.4, heading: 0 },
      {
        ...five()[0],
        id: "b",
        species: "angelfish",
        x: 0,
        z: -0.4,
        heading: Math.PI,
      },
    ]);
    let closest = Infinity;
    for (let i = 0; i < 6 * 30; i++) {
      s.advance(1 / 30);
      const [a, b] = s.all();
      closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
    }
    expect(closest).toBeGreaterThan(0.08);
  });

  it("heads for its goal along a smooth curve", () => {
    const s = school([{ ...five()[0], x: 0, z: 0.5, heading: Math.PI }]);
    const goal = { x: 0, y: 0, z: -0.6 };
    let heading = s.get("f0").heading;
    for (let i = 0; i < 12 * 30; i++) {
      s.advance(1 / 30, goal);
      const turn = Math.abs(s.get("f0").heading - heading);
      expect(turn).toBeLessThanOrEqual(2.2 / 30 + 1e-8);
      heading = s.get("f0").heading;
    }
    const f = s.get("f0");
    expect(Math.hypot(f.x - goal.x, f.z - goal.z)).toBeLessThan(0.4);
  });

  it("eases up and down toward its goal's depth, nose first", () => {
    const s = school([{ ...five()[0], x: 0, z: 0, heading: 0 }]);
    const goal = { x: 0, y: 0.5, z: 0 };
    let climb = 0,
      steepest = 0;
    for (let i = 0; i < 20 * 30; i++) {
      const before = s.get("f0").y;
      s.advance(1 / 30, goal);
      const speed = (s.get("f0").y - before) * 30;
      // Climbing speeds up gradually, never in a jump.
      expect(Math.abs(speed - climb)).toBeLessThan(0.01);
      climb = speed;
      steepest = Math.max(steepest, s.pitch("f0"));
    }
    expect(s.get("f0").y).toBeCloseTo(0.5, 1);
    expect(steepest).toBeGreaterThan(0.1);
    expect(steepest).toBeLessThan(0.4);
  });

  it("curls up to turn around at the end of a channel narrower than itself", () => {
    // A pond with a dead-end channel off it, a little wider than a curled
    // fish but narrower than a straight one.
    const open = (x: number, z: number) =>
      Math.hypot(x, z - 1) < 1 || (Math.abs(x) < 0.08 && z > -0.8);
    const channel: SwimWater = {
      ...pond,
      canSwim: (_id, x, _y, z, heading, clearance) => {
        const half = 0.1 * (clearance?.curl ? CURLED_LENGTH : 1);
        const dx = -Math.sin(heading) * half,
          dz = -Math.cos(heading) * half;
        return open(x + dx, z + dz) && open(x - dx, z - dz);
      },
    };
    const s = school([{ ...five()[0], x: 0, z: -0.3, heading: 0 }], channel);
    for (let i = 0; i < 15 * 30 && s.get("f0").z < 0.3; i++) {
      const before = s.get("f0");
      const { x, z, heading } = before;
      s.advance(1 / 30);
      const after = s.get("f0");
      // Never swims backward.
      expect(
        (after.x - x) * -Math.sin(heading) + (after.z - z) * -Math.cos(heading),
      ).toBeGreaterThanOrEqual(-1e-9);
    }
    expect(s.get("f0").z).toBeGreaterThanOrEqual(0.3);
  });
});

/** A fish never overlaps anything, except that one curled up from a tight
 * turn pushes leaves aside. */
function expectClear(
  space: SwimSpace,
  id: string,
  { position: { x, y, z }, direction, motion }: AnimalState,
) {
  const heading = Math.atan2(-direction.x, -direction.z);
  expect(
    space.canStart(id, x, y, z, heading, { curl: Math.sign(motion.bend) }),
  ).toBe(true);
}

/** Every fish's position, by id. */
function fishIn(world: World, engine: ReturnType<typeof createWorldEcosystem>) {
  return world.objects
    .filter((o) => assets[o.kind].swims)
    .map((o) => ({ object: o, state: engine.observeAnimal(o.id)! }));
}

describe("fish in a real tank", () => {
  it.each(["tropical", "amazon", "asian"] as const)(
    "stay in the %s water and inside the glass, and keep exploring",
    (preset) => {
      const world = makePreset(preset);
      const env = world.environment;
      const engine = createWorldEcosystem(world, undefined, randomFromSeed(8));
      const space = new SwimSpace(world);
      const fish = fishIn(world, engine);
      const traveled = new Map(fish.map(({ object }) => [object.id, 0]));
      for (let second = 0; second < 120; second++) {
        const before = fish.map(({ state }) => ({ ...state.position }));
        engine.advance(0.25);
        engine.advance(0.25);
        engine.advance(0.25);
        engine.advance(0.25);
        for (const [i, { object, state }] of fish.entries()) {
          const { x, z } = state.position;
          expect(Math.abs(x)).toBeLessThan(env.width / 2);
          expect(Math.abs(z)).toBeLessThan(env.depth / 2);
          expect(placementProblem("fish", x, z, env)).toBeNull();
          expectClear(space, object.id, state);
          traveled.set(
            object.id,
            traveled.get(object.id)! +
              Math.hypot(x - before[i].x, z - before[i].z),
          );
        }
      }
      if (preset === "amazon")
        for (const { object } of fish)
          expect(
            traveled.get(object.id),
            `${object.kind} keeps exploring`,
          ).toBeGreaterThan(assets[object.kind].swims!.speed * 120 * 0.2);
    },
  );

  it("don't get wedged between the glass and the planting", () => {
    // Windows of six seconds a fish spent stuck in place, by species.
    const stuck = new Map<string, { stuck: number; windows: number }>();
    for (const seed of [1, 2]) {
      const world = makePreset("amazon");
      const engine = createWorldEcosystem(
        world,
        undefined,
        randomFromSeed(seed),
      );
      const fish = fishIn(world, engine);
      for (let window = 0; window < 30; window++) {
        const start = fish.map(({ state }) => ({ ...state.position }));
        const farthest = fish.map(() => 0);
        for (let tick = 0; tick < 6 * 30; tick++) {
          engine.advance(1 / 30);
          fish.forEach(({ state }, i) => {
            const { x, z } = state.position;
            farthest[i] = Math.max(
              farthest[i],
              Math.hypot(x - start[i].x, z - start[i].z),
            );
          });
        }
        fish.forEach(({ object }, i) => {
          const count = stuck.get(object.kind) ?? { stuck: 0, windows: 0 };
          count.windows++;
          if (farthest[i] < 0.25) count.stuck++;
          stuck.set(object.kind, count);
        });
      }
    }
    for (const [kind, count] of stuck)
      expect(count.stuck / count.windows, kind).toBeLessThan(0.1);
  }, 30_000);

  it("use their whole depth range in a deep tank", () => {
    const world = makePreset("amazon");
    const engine = createWorldEcosystem(world, undefined, randomFromSeed(4));
    const fish = fishIn(world, engine);
    const heights = new Map(
      fish.map(({ object, state }) => [
        object.id,
        { low: state.position.y, high: state.position.y },
      ]),
    );
    for (let second = 0; second < 120; second++) {
      engine.advance(0.25);
      engine.advance(0.25);
      engine.advance(0.25);
      engine.advance(0.25);
      for (const { object, state } of fish) {
        const range = heights.get(object.id)!;
        range.low = Math.min(range.low, state.position.y);
        range.high = Math.max(range.high, state.position.y);
      }
    }
    const spread = [...heights.values()].map((r) => r.high - r.low);
    expect(Math.max(...spread)).toBeGreaterThan(0.3);
  });

  it.each([
    [3, 0],
    [8, 0],
    [19, 0],
    [19, 3],
  ])(
    "Fish from older Cloud Forest saves escape tight starting spots and keep exploring (seed %s, ids %s)",
    (seed, idSeed) => {
      const world = makePreset("tropical");
      // Fixed ids, since crowded fish break ties by id and fresh random ids
      // made each run a different simulation.
      const ids = randomFromSeed(idSeed);
      // ID seed 3 reproduces #57: a retreat with an exhausted trail backed
      // into the bank near (0.54, 1.83), then stalled for whole minutes.
      world.objects.forEach((o, i) => {
        o.id = idSeed ? `id-${Math.floor(ids() * 1e9)}` : `object-${i}`;
      });
      // Preserve the full-size fish and placements from older saved worlds,
      // before the preset was changed to start smaller fish in open water.
      const poses = [
        [1.75, 0.95, 1.2],
        [2.1, 0.75, 1.1],
        [1.95, 0.2, 1.3],
        [2.4, 0.55, 1.25],
      ];
      world.objects
        .filter((o) => o.kind === "convict-cichlid")
        .forEach((o, i) => {
          const [x, z, rotation] = poses[i];
          Object.assign(o, { x, z, rotation, scale: 1 });
        });
      const engine = createWorldEcosystem(
        world,
        undefined,
        randomFromSeed(seed),
      );
      const space = new SwimSpace(world);
      const fish = fishIn(world, engine);
      // Check each minute independently: early movement must not hide a
      // fish spending the rest of the run rocking back and forth in a gap.
      for (let minute = 0; minute < 5; minute++) {
        const ranges = fish.map(({ state }) => ({
          minX: state.position.x,
          maxX: state.position.x,
          minZ: state.position.z,
          maxZ: state.position.z,
        }));
        for (let tick = 0; tick < 60 * 30; tick++) {
          engine.advance(1 / 30);
          fish.forEach(({ object, state }, i) => {
            const { x, z } = state.position;
            const range = ranges[i];
            range.minX = Math.min(range.minX, x);
            range.maxX = Math.max(range.maxX, x);
            range.minZ = Math.min(range.minZ, z);
            range.maxZ = Math.max(range.maxZ, z);
            expectClear(space, object.id, state);
          });
        }
        for (const range of ranges)
          expect(
            Math.hypot(range.maxX - range.minX, range.maxZ - range.minZ),
            `exploration during minute ${minute + 1}`,
          ).toBeGreaterThan(0.2);
      }
    },
  );

  it.each([
    "amazon",
    "asian",
    "tropical",
    "mountain",
    "grotto",
    "desert",
    "island",
  ] as const)(
    "start in open water where the %s preset places them",
    (preset) => {
      const world = makePreset(preset);
      const engine = createWorldEcosystem(world);
      for (const { object, state } of fishIn(world, engine))
        expect([state.position.x, state.position.z], object.kind).toEqual([
          object.x,
          object.z,
        ]);
    },
  );

  it("keep their place and pace through an unrelated edit", () => {
    const world = makePreset("tropical");
    const engine = createWorldEcosystem(world, undefined, () => 0.5);
    for (let tick = 0; tick < 300; tick++) engine.advance(1 / 30);
    const edited = structuredClone(world);
    edited.environment.warmth = 0.2;
    const rebuilt = createWorldEcosystem(edited, { world, engine }, () => 0.5);
    const ids = fishIn(world, engine).map(({ object }) => object.id);
    for (const id of ids)
      expect(rebuilt.swimmer(id)).toEqual(engine.swimmer(id));
  });
});
