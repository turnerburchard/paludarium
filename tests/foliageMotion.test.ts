import { describe, expect, it } from "vitest";
import { FoliageMotion, type FoliageVisitor } from "../src/scene/foliageMotion";

const base = { x: 0, y: 0, z: 0 };
const visitor = (x: number, y = 0.2, z = 0): FoliageVisitor => ({
  position: { x, y, z },
  radius: 0.15,
});

function pass(speed: number, side = 1, y = 0.2, z = 0) {
  const motion = new FoliageMotion(7, "plant");
  const idle = new FoliageMotion(7, "plant");
  for (let i = 0; i <= 20; i++) {
    const x = side * (0.15 + (20 - i) * speed * 0.02);
    motion.update(0.02, base, 0.4, 1, [visitor(x, y, z)]);
    idle.update(0.02, base, 0.4, 1, []);
  }
  return { motion, idle, bend: motion.tilt.x - idle.tilt.x };
}

describe("foliage movement", () => {
  it("sways gently and varies with the seed", () => {
    const a = new FoliageMotion(7, "plant"),
      b = new FoliageMotion(8, "plant");
    const first = { ...a.update(0.02, base, 0.4, 1, []) };
    for (let i = 0; i < 100; i++) {
      a.update(0.02, base, 0.4, 1, []);
      expect(Math.abs(a.tilt.x)).toBeLessThanOrEqual(0.009);
      expect(Math.abs(a.tilt.z)).toBeLessThanOrEqual(0.007);
    }
    expect(a.tilt).not.toEqual(first);
    expect(b.update(2.02, base, 0.4, 1, [])).not.toEqual(a.tilt);
  });

  it("bends away from creatures on either side, more strongly than ambient sway", () => {
    expect(pass(0.5).bend).toBeLessThan(-0.04);
    expect(pass(0.5, -1).bend).toBeGreaterThan(0.04);
    const motion = new FoliageMotion(7, "plant"),
      idle = new FoliageMotion(7, "plant");
    motion.update(0.02, base, 0.4, 1, [visitor(0, 0.2, -0.2)]);
    motion.update(0.02, base, 0.4, 1, [visitor(0, 0.2, -0.19)]);
    idle.update(0.04, base, 0.4, 1, []);
    expect(motion.tilt.z - idle.tilt.z).toBeGreaterThan(0);
  });

  it("holds foliage away from a creature that stops nearby", () => {
    const { motion, idle, bend } = pass(0.5);
    for (let i = 0; i < 150; i++) {
      motion.update(0.02, base, 0.4, 1, [visitor(0.15)]);
      idle.update(0.02, base, 0.4, 1, []);
    }
    expect(motion.tilt.x - idle.tilt.x).toBeLessThanOrEqual(bend);
    expect(pass(0).bend).toBeLessThan(-0.04);
  });

  it("ignores creatures outside the horizontal or vertical reach", () => {
    expect(pass(0.5, 1, 3).bend).toBe(0);
    expect(pass(0.5, 1, 0.2, 3).bend).toBe(0);
  });

  it("eases toward nearby creatures even when they are newly placed", () => {
    const motion = new FoliageMotion(7, "plant"),
      idle = new FoliageMotion(7, "plant");
    motion.update(0.02, base, 0.4, 1, [visitor(0.2)]);
    idle.update(0.02, base, 0.4, 1, []);
    const bend = motion.tilt.x - idle.tilt.x;
    expect(bend).toBeLessThan(0);
    expect(Math.abs(bend)).toBeLessThan(0.03);
  });

  it("freezes when paused, then settles smoothly after a creature leaves", () => {
    const { motion, idle, bend } = pass(0.5);
    const paused = { ...motion.tilt };
    expect(motion.update(0, base, 0.4, 1, [])).toEqual(paused);
    motion.update(0.02, base, 0.4, 1, []);
    idle.update(0.02, base, 0.4, 1, []);
    const remaining = motion.tilt.x - idle.tilt.x;
    expect(Math.abs(remaining)).toBeLessThan(Math.abs(bend));
    expect(Math.abs(remaining)).toBeGreaterThan(Math.abs(bend) * 0.8);
    for (let i = 0; i < 150; i++) {
      motion.update(0.02, base, 0.4, 1, []);
      idle.update(0.02, base, 0.4, 1, []);
    }
    expect(motion.tilt.x).toBeCloseTo(idle.tilt.x, 4);
  });

  it("leans toward a perched animal, including leaves beyond the ground footprint", () => {
    const motion = new FoliageMotion(7, "plant"),
      idle = new FoliageMotion(7, "plant");
    const perched = { ...visitor(0.9, 1), perchedOn: "plant" };
    for (let i = 0; i < 100; i++) {
      motion.update(0.02, base, 0.4, 1, [perched]);
      idle.update(0.02, base, 0.4, 1, []);
    }
    expect(motion.tilt.x - idle.tilt.x).toBeGreaterThan(0.04);
    expect(pass(0).bend).toBeLessThan(0);
  });

  it("uses animal size for weight and settles when the perch is empty", () => {
    const large = new FoliageMotion(7, "plant"),
      small = new FoliageMotion(7, "plant"),
      idle = new FoliageMotion(7, "plant");
    for (let i = 0; i < 100; i++) {
      large.update(0.02, base, 0.4, 1, [
        { ...visitor(0.5), perchedOn: "plant" },
      ]);
      small.update(0.02, base, 0.4, 1, [
        { ...visitor(0.5), perchedOn: "plant", radius: 0.05 },
      ]);
      idle.update(0.02, base, 0.4, 1, []);
    }
    expect(large.tilt.x - idle.tilt.x).toBeGreaterThan(
      small.tilt.x - idle.tilt.x,
    );
    for (let i = 0; i < 150; i++) {
      large.update(0.02, base, 0.4, 1, []);
      idle.update(0.02, base, 0.4, 1, []);
    }
    expect(large.tilt.x).toBeCloseTo(idle.tilt.x, 4);
  });

  it("still bends away from an animal perched on a different plant", () => {
    const motion = new FoliageMotion(7, "plant"),
      idle = new FoliageMotion(7, "plant");
    for (let i = 0; i < 100; i++) {
      motion.update(0.02, base, 0.4, 1, [
        { ...visitor(0.2), perchedOn: "other-plant" },
      ]);
      idle.update(0.02, base, 0.4, 1, []);
    }
    expect(motion.tilt.x - idle.tilt.x).toBeLessThan(-0.04);
  });

  it("limits the combined bend from crowds", () => {
    const motion = new FoliageMotion(7, "plant"),
      idle = new FoliageMotion(7, "plant");
    for (let i = 0; i < 100; i++) {
      const crowd = Array.from({ length: 20 }, () => visitor(0.1 + i * 0.001));
      motion.update(0.02, base, 0.4, 1, crowd);
      idle.update(0.02, base, 0.4, 1, []);
      expect(
        Math.hypot(motion.tilt.x - idle.tilt.x, motion.tilt.z - idle.tilt.z),
      ).toBeLessThanOrEqual(0.18);
    }
  });
});
