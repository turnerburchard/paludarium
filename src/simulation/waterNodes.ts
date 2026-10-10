import type { World } from "../model/schema";
import { depthAt, placementProblem, waterLevel } from "../model/water";
import { groundHeight } from "../model/terrain";
import type { SwimSpace } from "./swimSpace";
import type { HabitatNode, Vec3 } from "./types";

const SPACING = 0.3;
/** Levels from the surface to the bottom of each water column. */
const LEVELS = 6;
/** The sizes of open water a node is checked for, widest first, as half the
 * width and height of a fish body. A fish needs a node with room for it. */
const ROOMS = [0.3, 0.2, 0.15, 0.1, 0.06, 0.03];
/** The widest room admits any fish, since the graph only guides routes and
 * steering checks the whole body. */
export const WIDEST_ROOM = ROOMS[0];

/** A lattice through the open water for fish to route along. Each column
 * follows the ground, so a level keeps the same share of the water's depth. */
export function waterNodes(world: World, space: SwimSpace): HabitatNode[] {
  const env = world.environment;
  const nx = Math.floor(env.width / SPACING),
    nz = Math.floor(env.depth / SPACING);
  const grid = new Map<string, HabitatNode>();
  // Open water around a point, moved clear of the floor and surface. Shallow
  // water is as tall as it gets, and each node records how deep it is for
  // fish to check against their own height.
  const fits = (point: Vec3, half: number) => {
    const ground = groundHeight(point.x, point.z, env);
    const surface = waterLevel(point.x, point.z, env);
    const height = Math.min(half, (surface - ground) / 2 - 0.001);
    const y = Math.max(ground + height, Math.min(surface - height, point.y));
    return space.open({ ...point, y }, half, height);
  };
  for (let ix = 0; ix < nx; ix++)
    for (let iz = 0; iz < nz; iz++) {
      const x = -env.width / 2 + (ix + 0.5) * (env.width / nx);
      const z = -env.depth / 2 + (iz + 0.5) * (env.depth / nz);
      if (placementProblem("fish", x, z, env)) continue;
      const ground = groundHeight(x, z, env);
      const surface = waterLevel(x, z, env);
      for (let level = 0; level < LEVELS; level++) {
        const y = surface - ((surface - ground) * level) / (LEVELS - 1);
        const position = { x, y, z };
        const room = ROOMS.find((half) => fits(position, half));
        if (room === undefined) continue;
        grid.set(`${ix}:${iz}:${level}`, {
          id: `w:${ix}:${iz}:${level}`,
          position,
          normal: { x: 0, y: 1, z: 0 },
          surface: "water",
          wet: true,
          submerged: true,
          shelter: 0,
          swim: {
            depth: depthAt(x, z, env, y),
            bottom: level === LEVELS - 1,
            room,
            column: surface - ground,
          },
          neighbors: [],
        });
      }
    }
  // Each pair once: the eight around a node on its level, plus the nine
  // touching it on the level below.
  const offsets: [number, number, number][] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      offsets.push([dx, dz, 1]);
      if (dx > 0 || (dx === 0 && dz > 0)) offsets.push([dx, dz, 0]);
    }
  for (const [key, node] of grid) {
    const [ix, iz, level] = key.split(":").map(Number);
    for (const [dx, dz, dl] of offsets) {
      const other = grid.get(`${ix + dx}:${iz + dz}:${level + dl}`);
      if (!other) continue;
      const a = node.position,
        b = other.position;
      const middle = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        z: (a.z + b.z) / 2,
      };
      if (!fits(middle, ROOMS[ROOMS.length - 1])) continue;
      node.neighbors.push(other.id);
      other.neighbors.push(node.id);
    }
  }
  return [...grid.values()];
}
