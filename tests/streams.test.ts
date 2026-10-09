import { describe, expect, it } from "vitest";
import { withEnvironment } from "../src/editor/useEditor";
import { makePreset } from "../src/model/presets";
import { emptyWorld, environmentSchema, type World } from "../src/model/schema";
import { streamCourse, streamSurface } from "../src/model/streams";
import { baseGroundHeight, groundHeight } from "../src/model/terrain";
import { newTerrain } from "../src/model/terrainData";
import { applyTerrainBrush } from "../src/model/terrainBrush";
import { buildHabitat } from "../src/simulation/worldHabitat";

/** A ramp falling evenly from the left of the default tank into its pool
 * on the right, with a wide stream running down it. */
function worldWithStream(): World {
  const world = emptyWorld();
  const env = world.environment;
  env.terrain = newTerrain(
    env,
    (x, z) => 0.7 - 0.12 * x - baseGroundHeight(x, z, env),
  );
  env.streams = [
    {
      path: [
        [-0.45, 0],
        [0.45, 0],
      ],
      width: 0.8,
    },
  ];
  return world;
}

describe("stream courses", () => {
  it("runs downhill from its source and ends where it meets the pool", () => {
    const env = worldWithStream().environment;
    const course = streamCourse(env.streams[0], env);
    expect(course[0].y).toBeGreaterThan(env.water + 0.2);
    for (let i = 1; i < course.length; i++)
      expect(course[i].y).toBeLessThanOrEqual(course[i - 1].y);
    expect(course.at(-1)!.y).toBe(env.water);
    expect(course.at(-1)!.x).toBeLessThan(0.45 * env.width);
  });

  it("keeps its level under a rise in the bed instead of climbing it", () => {
    let env = worldWithStream().environment;
    for (let i = 0; i < 6; i++)
      env = applyTerrainBrush(env, -1.5, 0, { mode: "raise", radius: 0.4 });
    const course = streamCourse(env.streams[0], env);
    for (let i = 1; i < course.length; i++)
      expect(course[i].y).toBeLessThanOrEqual(course[i - 1].y);
    const top = course.reduce((a, b) =>
      Math.abs(a.x + 1.5) < Math.abs(b.x + 1.5) ? a : b,
    );
    expect(top.y).toBeLessThan(groundHeight(top.x, top.z, env));
  });

  it("stretches with the tank and its terrain", () => {
    const world = worldWithStream();
    const wider = withEnvironment(world, { width: 14 }).environment;
    expect(streamCourse(wider.streams[0], wider)[0].x).toBeCloseTo(
      2 * streamCourse(world.environment.streams[0], world.environment)[0].x,
    );
  });

  it("finds the water surface only within the stream's width", () => {
    const env = worldWithStream().environment;
    const surfaceAt = streamSurface(env);
    expect(surfaceAt(-2, 0.3)).toBeGreaterThan(groundHeight(-2, 0.3, env));
    expect(surfaceAt(-2, 0.5)).toBeNull();
  });

  it("validates the presets that have streams", () => {
    for (const preset of ["tropical", "mountain", "grotto"] as const) {
      const env = makePreset(preset).environment;
      expect(env.streams.length, preset).toBeGreaterThan(0);
      expect(environmentSchema.safeParse(env).success, preset).toBe(true);
    }
  });
});

describe("streams in the habitat", () => {
  it("wets the bank a stream runs over without submerging it", () => {
    const wetBank = (world: World) =>
      [...buildHabitat(world).nodes.values()].filter(
        (node) =>
          node.surface === "ground" &&
          node.wet &&
          node.position.y > world.environment.water + 0.1,
      );
    const world = worldWithStream();
    expect(
      wetBank({ ...world, environment: { ...world.environment, streams: [] } }),
    ).toEqual([]);
    const nodes = wetBank(world);
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(Math.abs(node.position.z)).toBeLessThanOrEqual(0.4);
      expect(node.submerged).toBe(false);
    }
  });
});
