import { describe, expect, it } from "vitest";
import { FishSchool, type Fish } from "../src/simulation/fish";
import { randomFromSeed } from "../src/model/random";
import { makePreset } from "../src/model/presets";
import { placementProblem } from "../src/model/terrain";
import { createFishSchool } from "../src/simulation/worldHabitat";

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
});

describe("fish in a real tank", () => {
  it("stay in the pond and inside the glass", () => {
    const world = makePreset("tropical");
    const env = world.environment;
    const school = createFishSchool(world);
    for (let second = 0; second < 300; second++) {
      run(school, 1);
      for (const f of school.all()) {
        expect(Math.abs(f.x)).toBeLessThan(env.width / 2);
        expect(Math.abs(f.z)).toBeLessThan(env.depth / 2);
        expect(placementProblem("fish", f.x, f.z, env)).toBeNull();
      }
    }
  });

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
