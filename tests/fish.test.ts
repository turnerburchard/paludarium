import { describe, expect, it } from "vitest";
import { FishSchool, type Fish } from "../src/simulation/fish";
import { randomFromSeed } from "../src/model/random";
import { makePreset } from "../src/model/presets";
import { placementProblem } from "../src/model/terrain";
import { createFishSchool } from "../src/simulation/worldHabitat";
import { SwimSpace } from "../src/simulation/swimSpace";

/** A round pond of radius 1 centered on the origin. */
const pond = (x: number, z: number) => Math.hypot(x, z) < 1;
const school = (fish: Fish[]) =>
  new FishSchool(fish, pond, { random: randomFromSeed(3) });
const run = (s: FishSchool, seconds: number) => {
  for (let i = 0; i < seconds * 30; i++) s.advance(1 / 30);
};
const five = (): Fish[] =>
  [0, 1, 2, 3, 4].map((i) => ({
    id: `f${i}`,
    species: "fish",
    speed: 0.22,
    x: Math.cos(i) * 0.5,
    z: Math.sin(i) * 0.5,
    heading: i,
  }));

describe("fish school", () => {
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
        { id: "lone", species, speed: 0.22, x: 0, z: 0, heading: 0 },
        ...[0, 1, 2, 3].map((i) => ({
          id: `f${i}`,
          species: "tetra",
          speed: 0.22,
          x: Math.cos(i * 1.6) * 0.2,
          z: Math.sin(i * 1.6) * 0.2,
          heading: Math.PI,
        })),
      ]);
      run(s, 1);
      return Math.abs(Math.sin(s.get("lone")!.heading / 2));
    };
    expect(turnAfterASecond("tetra")).toBeGreaterThan(
      turnAfterASecond("guppy") + 0.2,
    );
  });

  it("drift apart for a while instead of always schooling", () => {
    // A wide pool, so a roaming fish has room to leave the others.
    const s = new FishSchool(five(), (x, z) => Math.hypot(x, z) < 3, {
      random: randomFromSeed(3),
    });
    let apart = 0;
    for (let second = 0; second < 240; second++) {
      run(s, 1);
      const fish = s.all();
      if (
        fish.some((a) =>
          fish.every((b) => a === b || Math.hypot(a.x - b.x, a.z - b.z) > 0.9),
        )
      )
        apart++;
    }
    expect(apart / 240).toBeGreaterThan(0.15);
    expect(apart / 240).toBeLessThan(0.85);
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
          if (a !== b && Math.hypot(a.x - b.x, a.z - b.z) < 0.08) crowded++;
    }
    expect(crowded).toBeLessThan(20);
  });

  it("holds still while paused or held", () => {
    const s = school(five());
    const start = s.all();
    s.advance(1, true);
    expect(s.all()).toEqual(start);
    for (let i = 0; i < 30; i++) s.advance(1 / 30, false, new Set(["f0"]));
    expect(s.get("f0")).toEqual(start[0]);
    expect(s.get("f1")).not.toEqual(start[1]);
  });

  it("caps long frames so a hidden tab can't jump", () => {
    const capped = school(five());
    capped.advance(30);
    const stepped = school(five());
    stepped.advance(0.1);
    expect(capped.all()).toEqual(stepped.all());
  });

  it("ignores frames with no elapsed time", () => {
    const s = school(five());
    const before = s.all();
    s.advance(0);
    s.advance(-1);
    expect(s.all()).toEqual(before);
  });

  it("retains its pace and ongoing turns when the habitat is rebuilt", () => {
    const original = new FishSchool(five(), pond, { random: () => 0.5 });
    run(original, 8);
    const rebuilt = new FishSchool(original.all(), pond, {
      random: () => 0.5,
      previous: original,
    });
    for (let tick = 0; tick < 90; tick++) {
      original.advance(1 / 30);
      rebuilt.advance(1 / 30);
      expect(rebuilt.all()).toEqual(original.all());
    }
  });
});

describe("fish in a real tank", () => {
  it.each(["tropical", "aquarium"] as const)(
    "stay in the %s water and inside the glass",
    (preset) => {
      const world = makePreset(preset);
      const env = world.environment;
      const school = createFishSchool(world, undefined, randomFromSeed(8));
      const space = new SwimSpace(world);
      const traveled = new Map(school.all().map((fish) => [fish.id, 0]));
      for (let second = 0; second < 300; second++) {
        const before = school.all();
        for (let tick = 0; tick < 10; tick++) school.advance(0.1);
        for (const [i, f] of school.all().entries()) {
          expect(Math.abs(f.x)).toBeLessThan(env.width / 2);
          expect(Math.abs(f.z)).toBeLessThan(env.depth / 2);
          expect(placementProblem("fish", f.x, f.z, env)).toBeNull();
          expect(space.canStart(f, f.x, f.z, f.heading)).toBe(true);
          traveled.set(
            f.id,
            traveled.get(f.id)! +
              Math.hypot(f.x - before[i].x, f.z - before[i].z),
          );
        }
      }
      if (preset === "aquarium")
        for (const fish of school.all())
          expect(
            traveled.get(fish.id),
            `${fish.species} keeps exploring`,
          ).toBeGreaterThan(fish.speed * 300 * 0.2);
    },
    20_000,
  );

  it.each([
    [3, 60],
    [8, 30],
    [19, 10],
  ])(
    "Fish from older Cloud Forest saves escape tight starting spots and keep exploring (seed %s, %s fps)",
    (seed, fps) => {
      const world = makePreset("tropical");
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
      const school = createFishSchool(world, undefined, randomFromSeed(seed));
      const space = new SwimSpace(world);
      // Check each minute independently: early movement must not hide a
      // fish spending the rest of the run rocking back and forth in a gap.
      for (let minute = 0; minute < 10; minute++) {
        const ranges = school.all().map((f) => ({
          minX: f.x,
          maxX: f.x,
          minZ: f.z,
          maxZ: f.z,
        }));
        for (let tick = 0; tick < 60 * fps; tick++) {
          school.advance(1 / fps);
          school.all().forEach((f, i) => {
            const range = ranges[i];
            range.minX = Math.min(range.minX, f.x);
            range.maxX = Math.max(range.maxX, f.x);
            range.minZ = Math.min(range.minZ, f.z);
            range.maxZ = Math.max(range.maxZ, f.z);
            expect(space.canStart(f, f.x, f.z, f.heading)).toBe(true);
          });
        }
        for (const range of ranges)
          expect(
            Math.hypot(range.maxX - range.minX, range.maxZ - range.minZ),
            `exploration during minute ${minute + 1}`,
          ).toBeGreaterThan(0.2);
      }
    },
    20_000,
  );

  it.each(["aquarium", "tropical", "mountain", "grotto", "desert"] as const)(
    "start in open water where the %s preset places them",
    (preset) => {
      const world = makePreset(preset);
      for (const fish of createFishSchool(world).all()) {
        const placed = world.objects.find((o) => o.id === fish.id)!;
        expect([fish.x, fish.z], fish.species).toEqual([placed.x, placed.z]);
      }
    },
  );

  it("keep their place through an unrelated edit", () => {
    const world = makePreset("tropical");
    const school = createFishSchool(world);
    run(school, 10);
    const edited = structuredClone(world);
    edited.environment.warmth = 0.2;
    expect(createFishSchool(edited, { world, fish: school }).all()).toEqual(
      school.all(),
    );
  });
});
