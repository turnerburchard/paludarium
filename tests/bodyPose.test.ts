import { describe, expect, it } from "vitest";
import { emptyWorld } from "../src/model/schema";
import { randomFromSeed } from "../src/model/random";
import { createWorldEcosystem } from "../src/simulation/worldHabitat";
import { fitBody, follow, type Body } from "../src/simulation/bodyPose";
import type { Caster, SurfaceHit } from "../src/simulation/solids";
import type { Vec3 } from "../src/simulation/types";

const frog: Body = { length: 0.2, width: 0.18, height: 0.1 };
const up = { x: 0, y: 1, z: 0 };
const ahead = { x: 1, y: 0, z: 0 };
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Solid half-spaces, each given by a point on its face and the way it faces. */
function planes(...faces: { point: Vec3; normal: Vec3 }[]): Caster {
  return {
    cast(origin, direction, far) {
      let best: SurfaceHit | undefined;
      for (const { point, normal } of faces) {
        const facing = dot(direction, normal);
        if (facing >= 0) continue;
        const height = dot(origin, normal) - dot(point, normal);
        if (height < 0) continue;
        const distance = height / -facing;
        if (distance > Math.min(far, best?.distance ?? far)) continue;
        best = {
          point: {
            x: origin.x + direction.x * distance,
            y: origin.y + direction.y * distance,
            z: origin.z + direction.z * distance,
          },
          distance,
        };
      }
      return best;
    },
  };
}

/** A pebble: a ball sitting on the floor. */
function pebble(centre: Vec3, radius: number): Caster {
  const floor = planes({ point: { x: 0, y: 0, z: 0 }, normal: up });
  return {
    cast(origin, direction, far) {
      const to = {
        x: origin.x - centre.x,
        y: origin.y - centre.y,
        z: origin.z - centre.z,
      };
      const b = dot(to, direction);
      const c = dot(to, to) - radius * radius;
      const root = b * b - c;
      const distance = -b - Math.sqrt(root);
      const ground = floor.cast(origin, direction, far);
      if (root < 0 || c < 0 || distance > far || distance < 0) return ground;
      if (ground && ground.distance < distance) return ground;
      const point = {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
        z: origin.z + direction.z * distance,
      };
      return { point, distance };
    },
  };
}

const floor = planes({ point: { x: 0, y: 0, z: 0 }, normal: up });

describe("setting a body down", () => {
  it("rests flat on flat ground", () => {
    const pose = fitBody(
      { position: { x: 0, y: 0, z: 0 }, normal: up, direction: ahead },
      frog,
      floor,
    );
    expect(pose.position.y).toBeCloseTo(0);
    expect(pose.normal.y).toBeCloseTo(1);
    expect(pose.direction.x).toBeCloseTo(1);
  });

  it("leans with a slope it was given level on", () => {
    const slope = { x: -Math.sin(0.3), y: Math.cos(0.3), z: 0 };
    const pose = fitBody(
      { position: { x: 0, y: 0, z: 0 }, normal: up, direction: ahead },
      frog,
      planes({ point: { x: 0, y: 0, z: 0 }, normal: slope }),
    );
    expect(pose.normal.x).toBeCloseTo(slope.x, 2);
    expect(pose.normal.y).toBeCloseTo(slope.y, 2);
  });

  it("tips its nose up a wall it walks into, keeping its tail out of the floor", () => {
    const wall = {
      point: { x: 0.05, y: 0, z: 0 },
      normal: { x: -1, y: 0, z: 0 },
    };
    const pose = fitBody(
      { position: { x: 0, y: 0, z: 0 }, normal: up, direction: ahead },
      frog,
      planes({ point: { x: 0, y: 0, z: 0 }, normal: up }, wall),
    );
    // Partway around the corner: facing up the wall more than along the floor.
    expect(pose.direction.y).toBeGreaterThan(0.4);
    // Where the hind feet are, a little in from the tip of the tail.
    const tail = {
      x: pose.position.x - pose.direction.x * frog.length * 0.42,
      y: pose.position.y - pose.direction.y * frog.length * 0.42,
    };
    expect(tail.y).toBeGreaterThan(-0.005);
    expect(pose.position.x).toBeLessThan(0.05);
  });

  it("comes down onto the ground from a straight line over a dip", () => {
    const pose = fitBody(
      { position: { x: 0, y: 0.25, z: 0 }, normal: up, direction: ahead },
      frog,
      floor,
    );
    expect(pose.position.y).toBeCloseTo(0, 3);
  });

  it("is only kept clear of the ground on a leaf, never pulled down to it", () => {
    const pose = fitBody(
      { position: { x: 0, y: 0.25, z: 0 }, normal: up, direction: ahead },
      frog,
      floor,
      false,
    );
    expect(pose.position.y).toBeCloseTo(0.25);
  });

  it("tips onto one end over a pebble rather than balancing on it", () => {
    const pose = fitBody(
      { position: { x: 0, y: 0.03, z: 0 }, normal: up, direction: ahead },
      frog,
      pebble({ x: 0, y: 0, z: 0 }, 0.03),
    );
    const ends = [1, -1].map(
      (side) => pose.position.y + (side * pose.direction.y * frog.length) / 2,
    );
    expect(Math.min(...ends)).toBeLessThan(0.006);
  });
});

describe("drawing a set-down body", () => {
  it("leaves the simulation's own state as it was", () => {
    const world = emptyWorld();
    world.objects = [
      {
        id: "frog",
        kind: "dart-frog",
        x: 1,
        z: 0.5,
        scale: 1,
        rotation: 0,
        seed: 173,
      },
    ];
    const engine = createWorldEcosystem(world, undefined, randomFromSeed(3));
    for (let i = 0; i < 60; i++) {
      engine.advance(0.1);
      const before = engine.snapshot();
      const drawn = engine.observeRenderedAnimal("frog")!;
      expect(drawn.pose).toBeDefined();
      expect(engine.snapshot()).toEqual(before);
      expect(engine.getAnimal("frog")!.pose).toBeUndefined();
    }
  });
});

describe("a body finding a new footing", () => {
  const at = (x: number, y: number) => ({
    position: { x, y, z: 0 },
    normal: up,
    direction: ahead,
  });
  const still = { x: 0, y: 0, z: 0 };

  it("glides onto it over a few steps rather than jumping", () => {
    let pose = at(0, 0);
    const target = at(0, 0.05);
    const heights = [];
    for (let step = 0; step < 30; step++) {
      const next = follow(pose, target, still, 1);
      expect(next.position.y - pose.position.y).toBeLessThanOrEqual(0.0081);
      heights.push(next.position.y);
      pose = next;
    }
    expect(heights[0]).toBeLessThan(0.01);
    expect(pose).toBe(target);
  });

  it("keeps up with the spot it stands on as that moves", () => {
    const next = follow(at(0, 0), at(0.3, 0), { x: 0.3, y: 0, z: 0 }, 1);
    expect(next).toEqual(at(0.3, 0));
  });

  it("settles between two footings a fit wavers between", () => {
    let pose = at(0, 0);
    const heights = [];
    for (let step = 0; step < 40; step++) {
      pose = follow(pose, at(0, step % 2 ? 0.02 : 0), still, 1);
      heights.push(pose.position.y);
    }
    const late = heights.slice(20);
    expect(Math.max(...late) - Math.min(...late)).toBeLessThan(0.01);
  });
});
