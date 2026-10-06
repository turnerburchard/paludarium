import { describe, expect, it } from "vitest";
import { FishSchool, type Fish } from "../src/simulation/fish";
import { randomFromSeed } from "../src/model/random";

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
    x: Math.cos(i) * 0.5,
    z: Math.sin(i) * 0.5,
    heading: i,
  }));

describe("fish school", () => {
  it("never leaves the water", () => {
    const s = school(five());
    for (let second = 0; second < 300; second++) {
      run(s, 1);
      for (const f of s.all()) expect(pond(f.x, f.z)).toBe(true);
    }
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
