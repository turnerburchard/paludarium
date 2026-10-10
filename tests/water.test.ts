import { describe, expect, it } from "vitest";
import { withEnvironment } from "../src/editor/useEditor";
import { makePreset } from "../src/model/presets";
import {
  defaultEnvironment,
  emptyWorld,
  environmentSchema,
  type Environment,
  type Spring,
  type World,
} from "../src/model/schema";
import { baseGroundHeight, groundHeight } from "../src/model/terrain";
import { newTerrain } from "../src/model/terrainData";
import {
  STREAM_DEPTH,
  streamSurface,
  waterLevel,
  waterMap,
} from "../src/model/water";
import { buildHabitat } from "../src/simulation/worldHabitat";

/** A bowl this deep at its middle, falling to nothing at its edge. */
const bowl = (x: number, z: number, at: number, radius: number, depth = 0.3) =>
  depth * Math.max(0, 1 - (Math.hypot(x - at, z) / radius) ** 2) ** 2;

/** A tank whose ground falls evenly from left to right, into the water
 * along the right side, with bowls dug into the slope and, with `valley`,
 * rising this much per unit toward the front and back. */
function ramp(
  springs: Spring[],
  bowls: { at: number; radius: number }[] = [],
  water = defaultEnvironment.water,
  valley = 0,
): Environment {
  const env = { ...defaultEnvironment, water, springs };
  return {
    ...env,
    terrain: newTerrain(
      env,
      (x, z) =>
        0.75 -
        0.12 * x +
        valley * Math.abs(z) -
        bowls.reduce((sum, { at, radius }) => sum + bowl(x, z, at, radius), 0) -
        baseGroundHeight(x, z, env),
    ),
  };
}

const spring = (x: number, flow = 0.5): Spring => ({ x, z: 0, flow });

/** A stream's end runs on into still water, settling onto its surface. */
function expectEndsIn(course: { y: number }[], level: number) {
  expect(course.at(-1)!.y).toBeGreaterThanOrEqual(level);
  expect(course.at(-1)!.y).toBeLessThan(level + STREAM_DEPTH);
}

function expectDownhill(course: { y: number }[]) {
  for (let i = 1; i < course.length; i++)
    expect(course[i].y).toBeLessThanOrEqual(course[i - 1].y + 1e-9);
}

describe("water from springs", () => {
  it("runs a spring's water downhill into the tank's water", () => {
    const env = ramp([spring(-0.4)]);
    const { streams, pools } = waterMap(env);
    expect(pools).toEqual([]);
    expect(streams).toHaveLength(1);
    const [course] = streams;
    expect(course[0].x).toBeCloseTo(-0.4 * env.width, 0);
    expectDownhill(course);
    expectEndsIn(course, env.water);
    expect(course.at(-1)!.x).toBeGreaterThan(course[0].x + 3);
  });

  it("leaves a tank without springs as it was", () => {
    const env = ramp([], [{ at: -1.5, radius: 0.7 }]);
    expect(waterMap(env).pools).toEqual([]);
    expect(waterLevel(-1.5, 0, env)).toBe(env.water);
    expect(waterLevel(-1.5, 0, { ...env, water: 0 })).toBe(-Infinity);
  });

  it("fills a hollow below a spring to its rim, then spills on", () => {
    const env = ramp([spring(-0.42)], [{ at: -1.5, radius: 0.7 }]);
    const { pools, streams } = waterMap(env);
    expect(pools).toHaveLength(1);
    const [pool] = pools;
    expect(pool.level).toBeGreaterThan(groundHeight(-1.5, 0, env) + 0.1);
    expect(waterLevel(-1.5, 0, env)).toBe(pool.level);
    expect(waterLevel(-1.5, 1.2, env)).toBe(env.water);
    // One stream into the pool, and one out of it down to the water.
    expect(streams).toHaveLength(2);
    expectEndsIn(streams[0], pool.level);
    expectEndsIn(streams[1], env.water);
    for (const course of streams) expectDownhill(course);
  });

  it("spills out of a pool from within it, with water over the rim", () => {
    const env = ramp([spring(-0.42)], [{ at: -1.5, radius: 0.7 }]);
    const map = waterMap(env);
    const [pool] = map.pools;
    const outflow = map.streams[1];
    expect(waterLevel(outflow[0].x, outflow[0].z, env)).toBe(pool.level);
    expect(outflow[0].y).toBeGreaterThan(pool.level);
    expect(outflow[0].y).toBeLessThan(pool.level + 0.05);
    for (const point of outflow) {
      const ground = groundHeight(point.x, point.z, env);
      expect(point.y).toBeGreaterThan(ground);
      // Once past the rim it runs down with its bed.
      if (waterLevel(point.x, point.z, env) < ground)
        expect(point.y).toBeLessThanOrEqual(ground + STREAM_DEPTH + 1e-9);
    }
  });

  it("runs on into the water it meets", () => {
    const env = ramp([spring(-0.42)], [{ at: -1.5, radius: 0.7 }]);
    const { pools, streams } = waterMap(env);
    const inlet = streams[0].at(-1)!,
      outlet = streams[1].at(-1)!;
    expect(groundHeight(inlet.x, inlet.z, env)).toBeLessThan(
      pools[0].level - 0.02,
    );
    expect(groundHeight(outlet.x, outlet.z, env)).toBeLessThan(env.water);
    expectEndsIn(streams[1], env.water);
  });

  it("runs along the glass without stopping in place", () => {
    // Ground falling toward the back glass as well as to the right.
    const base = defaultEnvironment;
    const env = {
      ...base,
      springs: [{ x: -0.42, z: -0.4, flow: 0.5 }],
      terrain: newTerrain(
        base,
        (x, z) => 0.75 - 0.12 * x + 0.3 * z - baseGroundHeight(x, z, base),
      ),
    };
    const [course] = waterMap(env).streams;
    expect(course.some((point) => point.z < -env.depth / 2 + 0.3)).toBe(true);
    for (let i = 1; i < course.length; i++)
      expect(course[i].along).toBeGreaterThan(course[i - 1].along);
  });

  it("chains pools down a slope with water running between them", () => {
    const env = ramp(
      [spring(-0.45)],
      [
        { at: -2, radius: 0.6 },
        { at: 0, radius: 0.6 },
      ],
    );
    const { pools, streams } = waterMap(env);
    expect(pools).toHaveLength(2);
    expect(pools[0].level).toBeGreaterThan(pools[1].level);
    expect(streams).toHaveLength(3);
    expect(streams[1][0].x).toBeLessThan(streams[1].at(-1)!.x);
    expectEndsIn(streams[1], pools[1].level);
  });

  it("leaves hollows the water never reaches dry", () => {
    const env = ramp(
      [{ x: -0.45, z: 0.3, flow: 0.5 }],
      [{ at: -1.5, radius: 0.5 }],
    );
    expect(waterMap(env).pools).toEqual([]);
    expect(waterLevel(-1.5, 0, env)).toBe(env.water);
  });

  it("soaks away at the lowest point of a dry tank", () => {
    const env = ramp([spring(-0.4)], [], 0);
    const { streams, pools } = waterMap(env);
    expect(pools).toEqual([]);
    expect(streams).toHaveLength(1);
    expectDownhill(streams[0]);
    expect(streams[0].at(-1)!.x).toBeGreaterThan(3);
    expect(streams[0][0].width).toBeGreaterThan(0.3);
    expect(streams[0].at(-1)!.width).toBe(0);
  });

  it("joins streams that meet, and widens below where they do", () => {
    const env = ramp(
      [
        { x: -0.45, z: -0.2, flow: 0.5 },
        { x: -0.45, z: 0.2, flow: 0.5 },
      ],
      [],
      defaultEnvironment.water,
      0.2,
    );
    const { streams } = waterMap(env);
    expect(streams).toHaveLength(2);
    const [first, second] = streams;
    expect(first.at(-1)!.width).toBeGreaterThan(first[0].width);
    const joined = second.at(-1)!;
    expect(
      first.some(
        (point) =>
          Math.hypot(point.x - joined.x, point.z - joined.z) < point.width / 4,
      ),
    ).toBe(true);
  });

  it("keeps a spring on the same spot of terrain when the tank is resized", () => {
    const world: World = { ...emptyWorld(), environment: ramp([spring(-0.4)]) };
    const wider = withEnvironment(world, { width: 14 }).environment;
    expect(waterMap(wider).streams[0][0].x).toBeCloseTo(
      2 * waterMap(world.environment).streams[0][0].x,
      0,
    );
  });

  it("finds a stream's surface only within its width", () => {
    const env = ramp([spring(-0.4)]);
    const surfaceAt = streamSurface(env);
    const point = waterMap(env).streams[0][10];
    expect(surfaceAt(point.x, point.z)).toBeCloseTo(point.y);
    expect(surfaceAt(point.x, point.z + 0.6)).toBeNull();
  });

  it("validates every preset", () => {
    for (const preset of [
      "tropical",
      "mountain",
      "desert",
      "grotto",
      "island",
      "amazon",
      "asian",
    ] as const)
      expect(
        environmentSchema.safeParse(makePreset(preset).environment).success,
        preset,
      ).toBe(true);
  });
});

describe("water in the habitat", () => {
  const habitat = (env: Environment) => [
    ...buildHabitat({ ...emptyWorld(), environment: env }).nodes.values(),
  ];

  it("wets a stream's bank without submerging it", () => {
    const above = (env: Environment) =>
      habitat(env).filter(
        (node) =>
          node.surface === "ground" &&
          node.wet &&
          node.position.y > env.water + 0.1,
      );
    expect(above(ramp([]))).toEqual([]);
    const env = ramp([spring(-0.4)]);
    const nodes = above(env);
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) expect(node.submerged).toBe(false);
  });

  it("submerges the ground under a pool", () => {
    const env = ramp([spring(-0.42)], [{ at: -1.5, radius: 0.7 }]);
    const level = waterMap(env).pools[0].level;
    const under = habitat(env).filter(
      (node) =>
        node.surface === "ground" &&
        Math.hypot(node.position.x + 1.5, node.position.z) < 0.2,
    );
    expect(under.length).toBeGreaterThan(0);
    for (const node of under) {
      expect(node.position.y).toBeLessThan(level);
      expect(node.submerged).toBe(true);
    }
  });
});
