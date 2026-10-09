import { assets } from "../assets";
import type { AssetKind, Environment } from "./schema";
import { clamp, groundHeight } from "./terrain";
import { terrainGrid, terrainPoint, terrainPointCount } from "./terrainData";

/** Water is worked out on a grid of cells about this wide. */
const CELL = 0.1;
/** Running water this deep over its bed. */
export const STREAM_DEPTH = 0.06;
/** A full hollow shallower than this is run through rather than pooled. */
const POOL_DEPTH = 0.03;
/** How wide a spring's stream runs, from a trickle to a gush. Streams that
 * meet carry both springs' water, up to the widest. */
const TRICKLE_WIDTH = 0.2;
const GUSH_WIDTH = 0.7;
const WIDEST = 1.1;

export interface CoursePoint {
  x: number;
  z: number;
  /** The water's surface. */
  y: number;
  /** Distance along the stream from where it starts. */
  along: number;
  width: number;
}

export interface Pool {
  level: number;
  /** The cells under its surface. */
  cells: number[];
}

export interface WaterMap {
  columns: number;
  rows: number;
  /** The ground at each cell's center. */
  ground: Float64Array;
  pools: Pool[];
  /** Which pool covers each cell, or -1. */
  poolAt: Int32Array;
  /** The surface of the pool over each cell or along its shore, or
   * -Infinity. */
  shore: Float64Array;
  streams: CoursePoint[][];
}

/** The center of a cell. */
export function cellCenter(index: number, map: WaterMap, env: Environment) {
  const column = index % map.columns,
    row = Math.floor(index / map.columns);
  return {
    x: -env.width / 2 + ((column + 0.5) * env.width) / map.columns,
    z: -env.depth / 2 + ((row + 0.5) * env.depth) / map.rows,
  };
}

function cellAt(x: number, z: number, map: WaterMap, env: Environment) {
  const column = Math.floor((x / env.width + 0.5) * map.columns),
    row = Math.floor((z / env.depth + 0.5) * map.rows);
  return (
    Math.min(map.rows - 1, Math.max(0, row)) * map.columns +
    Math.min(map.columns - 1, Math.max(0, column))
  );
}

const maps = new WeakMap<Environment, WaterMap>();

/** Where the tank's water lies: the still water below the water level,
 * pools in the hollows its springs fill, and the streams between them. */
export function waterMap(env: Environment): WaterMap {
  let map = maps.get(env);
  if (!map) {
    map = buildWaterMap(env);
    maps.set(env, map);
  }
  return map;
}

/** The surface of the still water a spot is under or beside: a pool's, or
 * else the tank's water level, or -Infinity in a dry tank. Compare it with
 * the ground to tell whether the spot is under water. Running water is left
 * out, since it wets the ground rather than covering it. */
export function waterLevel(x: number, z: number, env: Environment): number {
  const still = env.water > 0 ? env.water : -Infinity;
  if (!env.springs.length) return still;
  const map = waterMap(env);
  return Math.max(still, map.shore[cellAt(x, z, map, env)]);
}

/** The highest still water anywhere in the tank, or -Infinity in a dry one. */
export function highestWater(env: Environment): number {
  const pools = env.springs.length ? waterMap(env).pools : [];
  return Math.max(
    env.water > 0 ? env.water : -Infinity,
    ...pools.map((pool) => pool.level),
  );
}

/** The highest water within `reach` of a spot: a pool's, a stream's or the
 * tank's water level. */
export function waterNear(
  x: number,
  z: number,
  env: Environment,
  reach: number,
): number {
  if (!env.springs.length) return env.water;
  const map = waterMap(env);
  let level = env.water;
  const columns = Math.ceil((reach * map.columns) / env.width),
    rows = Math.ceil((reach * map.rows) / env.depth);
  const center = cellAt(x, z, map, env);
  const column = center % map.columns,
    row = Math.floor(center / map.columns);
  for (
    let r = Math.max(0, row - rows);
    r <= Math.min(map.rows - 1, row + rows);
    r++
  )
    for (
      let c = Math.max(0, column - columns);
      c <= Math.min(map.columns - 1, column + columns);
      c++
    ) {
      const pool = map.pools[map.poolAt[r * map.columns + c]];
      if (!pool || pool.level <= level) continue;
      const cell = cellCenter(r * map.columns + c, map, env);
      if (Math.hypot(cell.x - x, cell.z - z) <= reach) level = pool.level;
    }
  return Math.max(level, streamSurface(env, reach)(x, z) ?? -Infinity);
}

/** Looks up the surface of the stream running over a spot, or within
 * `bank` of its edge, or null where there's none. */
export function streamSurface(env: Environment, bank = 0) {
  const streams = env.springs.length ? waterMap(env).streams : [];
  return (x: number, z: number): number | null => {
    let nearest = Infinity,
      surface: number | null = null;
    for (const course of streams)
      for (let i = 1; i < course.length; i++) {
        const a = course[i - 1],
          b = course[i];
        const dx = b.x - a.x,
          dz = b.z - a.z;
        const t = Math.min(
          1,
          Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
        );
        const distance = Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
        const reach = (a.width + (b.width - a.width) * t) / 2 + bank;
        if (distance <= reach && distance < nearest) {
          nearest = distance;
          surface = a.y + (b.y - a.y) * t;
        }
      }
    return surface;
  };
}

export function hasDryGround(env: Environment): boolean {
  const points = terrainPointCount(terrainGrid(env));
  for (let index = 0; index < points; index++) {
    const { x, z } = terrainPoint(index, env);
    if (groundHeight(x, z, env) >= waterLevel(x, z, env) + 0.025) return true;
  }
  return false;
}
/** Depths below the surface are given as in water 0.4 deep. Deeper water
 * stretches them in proportion, so schools spread through a deep tank, while
 * shallow ponds keep their real depths. */
function depthScale(x: number, z: number, env: Environment) {
  return Math.max(1, (waterLevel(x, z, env) - groundHeight(x, z, env)) / 0.4);
}
/** The height at a depth, on that 0.4-deep scale. */
export function heightAtDepth(
  x: number,
  z: number,
  env: Environment,
  depth: number,
) {
  return waterLevel(x, z, env) - depth * depthScale(x, z, env);
}
/** The depth of a height, on that 0.4-deep scale. */
export function depthAt(x: number, z: number, env: Environment, y: number) {
  return (waterLevel(x, z, env) - y) / depthScale(x, z, env);
}
/** The middle of a species' depth range, with clearance above the substrate. */
export function swimmingHeight(
  x: number,
  z: number,
  env: Environment,
  depth: readonly [number, number],
  clearance = 0.05,
): number {
  const middle = (depth[0] + Math.min(depth[1], 0.4)) / 2;
  return Math.max(
    groundHeight(x, z, env) + clearance,
    heightAtDepth(x, z, env, middle),
  );
}
export function placementProblem(
  kind: AssetKind,
  x: number,
  z: number,
  env: Environment,
  lift = 0,
): string | null {
  const ground = groundHeight(x, z, env) + lift;
  const level = waterLevel(x, z, env);
  if (assets[kind].habitat === "land" && ground < level + 0.025)
    return "Find a dry spot on the bank.";
  if (assets[kind].habitat === "water" && ground > level - 0.12)
    return "Find deeper water, or raise the water level.";
  return null;
}

function buildWaterMap(env: Environment): WaterMap {
  const columns = Math.max(1, Math.round(env.width / CELL)),
    rows = Math.max(1, Math.round(env.depth / CELL));
  const count = columns * rows;
  const map: WaterMap = {
    columns,
    rows,
    ground: new Float64Array(count),
    pools: [],
    poolAt: new Int32Array(count).fill(-1),
    shore: new Float64Array(count).fill(-Infinity),
    streams: [],
  };
  for (let i = 0; i < count; i++) {
    const { x, z } = cellCenter(i, map, env);
    map.ground[i] = groundHeight(x, z, env);
  }
  if (!env.springs.length) return map;
  const { fill, parent, sea } = flood(map, env);
  const next = (i: number) => downhill(i, map, fill, parent, sea);

  // Every cell each spring's water passes through, and how much reaches it.
  // Water that comes alongside an earlier spring's stream, close enough to
  // overlap it, runs into it rather than beside it.
  const flow = new Float64Array(count);
  const carried = new Uint8Array(count);
  const routes = env.springs.map((spring) => {
    const route: number[] = [];
    const reach = Math.ceil(springWidth(spring.flow) / 2 / CELL);
    for (
      let i = cellAt(spring.x * env.width, spring.z * env.depth, map, env);
      i >= 0 && route.length < count;
      i = next(i)
    ) {
      if (!carried[i]) {
        const stream = nearestStream(i, reach, map, fill, carried);
        if (stream >= 0) i = stream;
      }
      route.push(i);
      flow[i] += spring.flow;
      if (sea[i]) break;
    }
    for (const i of route) carried[i] = 1;
    return route;
  });

  // A hollow the water reaches fills to its rim, where it spills over.
  for (const route of routes)
    for (const i of route) {
      if (map.poolAt[i] !== -1 || fill[i] - map.ground[i] <= 1e-9) continue;
      const pool = hollow(i, map, fill);
      const deepest = Math.max(
        ...pool.cells.map((cell) => pool.level - map.ground[cell]),
      );
      const index = deepest >= POOL_DEPTH ? map.pools.length : -2;
      for (const cell of pool.cells) map.poolAt[cell] = index;
      if (index >= 0) map.pools.push(pool);
    }
  for (let i = 0; i < count; i++) if (map.poolAt[i] === -2) map.poolAt[i] = -1;
  for (const pool of map.pools)
    for (const cell of pool.cells)
      for (const n of [cell, ...neighbors(cell, map)])
        map.shore[n] = Math.max(map.shore[n], pool.level);

  // Streams run between the pools. Where one meets water an earlier one
  // already carries, it ends there and the widths downstream carry both.
  const drawn = new Uint8Array(count);
  const width = (i: number) => springWidth(flow[i]);
  for (const route of routes) {
    let cells: number[] = [],
      from: number | undefined,
      edge: number | undefined;
    const finish = (to?: number) => {
      if (cells.length > 1)
        map.streams.push(course(cells, from, to, map, env, width));
      cells = [];
    };
    for (const i of route) {
      const pool = map.poolAt[i];
      if (sea[i]) {
        cells.push(i);
        // In a dry tank the water soaks away at the lowest point.
        finish(map.ground[i] < env.water ? env.water : undefined);
        break;
      }
      if (pool >= 0) {
        if (cells.length) {
          cells.push(i);
          finish(map.pools[pool].level);
        }
        from = map.pools[pool].level;
        edge = i;
        continue;
      }
      // Water spilling out of a pool starts within it, so the two meet.
      if (!cells.length && edge !== undefined) cells.push(edge);
      cells.push(i);
      if (drawn[i]) {
        finish(map.ground[i] + STREAM_DEPTH);
        break;
      }
      drawn[i] = 1;
    }
    finish();
  }
  return map;
}

/** How wide a stream runs carrying this much spring water. */
function springWidth(flow: number) {
  return Math.min(
    WIDEST,
    TRICKLE_WIDTH + (GUSH_WIDTH - TRICKLE_WIDTH) * Math.max(0.15, flow),
  );
}

/** The nearest cell within `reach` cells that already carries an earlier
 * spring's water and lies no higher, or -1. */
function nearestStream(
  i: number,
  reach: number,
  map: WaterMap,
  fill: Float64Array,
  carried: Uint8Array,
) {
  const column = i % map.columns,
    row = Math.floor(i / map.columns);
  let nearest = -1,
    distance = Infinity;
  for (
    let r = Math.max(0, row - reach);
    r <= Math.min(map.rows - 1, row + reach);
    r++
  )
    for (
      let c = Math.max(0, column - reach);
      c <= Math.min(map.columns - 1, column + reach);
      c++
    ) {
      const n = r * map.columns + c;
      const d = Math.hypot(c - column, r - row);
      if (carried[n] && fill[n] <= fill[i] && d < distance) {
        nearest = n;
        distance = d;
      }
    }
  return nearest;
}

const NEIGHBORS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

function neighbors(i: number, map: WaterMap) {
  const column = i % map.columns,
    row = Math.floor(i / map.columns);
  const found: number[] = [];
  for (const [dc, dr] of NEIGHBORS) {
    const c = column + dc,
      r = row + dr;
    if (c >= 0 && c < map.columns && r >= 0 && r < map.rows)
      found.push(r * map.columns + c);
  }
  return found;
}

/** How high each cell's water would stand if it filled every hollow on its
 * way out, flooding outward from the still water (or, in a dry tank, from
 * the lowest point, where water soaks away). Each cell also remembers the
 * neighbor its water leaves through, which carries it across flat ground
 * and out of a full hollow. */
function flood(map: WaterMap, env: Environment) {
  const count = map.ground.length;
  const fill = new Float64Array(count).fill(Infinity);
  const parent = new Int32Array(count).fill(-1);
  const sea = new Uint8Array(count);
  const queue = new Heap();
  for (let i = 0; i < count; i++)
    if (map.ground[i] < env.water) {
      sea[i] = 1;
      fill[i] = map.ground[i];
      queue.push(i, fill[i]);
    }
  if (!queue.size) {
    let lowest = 0;
    for (let i = 1; i < count; i++)
      if (map.ground[i] < map.ground[lowest]) lowest = i;
    sea[lowest] = 1;
    fill[lowest] = map.ground[lowest];
    queue.push(lowest, fill[lowest]);
  }
  while (queue.size) {
    const i = queue.pop();
    for (const n of neighbors(i, map)) {
      if (fill[n] !== Infinity) continue;
      fill[n] = Math.max(map.ground[n], fill[i]);
      parent[n] = i;
      queue.push(n, fill[n]);
    }
  }
  return { fill, parent, sea };
}

/** Where water goes from a cell: down the steepest way, or where the ground
 * is flat or under a full hollow, the way the flood came in. */
function downhill(
  i: number,
  map: WaterMap,
  fill: Float64Array,
  parent: Int32Array,
  sea: Uint8Array,
) {
  if (sea[i]) return -1;
  let best = parent[i],
    steepest = 0;
  const column = i % map.columns,
    row = Math.floor(i / map.columns);
  for (const n of neighbors(i, map)) {
    const drop = fill[i] - fill[n];
    if (drop <= 1e-9) continue;
    const diagonal =
      n % map.columns !== column && Math.floor(n / map.columns) !== row;
    const slope = drop / (diagonal ? Math.SQRT2 : 1);
    if (slope > steepest) {
      steepest = slope;
      best = n;
    }
  }
  return best;
}

/** The full hollow around a cell: every cell under the same surface. */
function hollow(start: number, map: WaterMap, fill: Float64Array): Pool {
  const level = fill[start];
  const cells = [start];
  const seen = new Set(cells);
  for (let k = 0; k < cells.length; k++)
    for (const n of neighbors(cells[k], map)) {
      if (seen.has(n)) continue;
      seen.add(n);
      if (Math.abs(fill[n] - level) < 1e-9 && fill[n] > map.ground[n] + 1e-9)
        cells.push(n);
    }
  return { level, cells };
}

/** A stream's course through a run of cells, rounded off so it doesn't
 * zigzag along the grid. Its surface keeps a little above the bed and never
 * climbs, so where the bed rises the water runs under the rise. Spilling out
 * of a pool at `from`, it starts a little above the pool so there's water
 * over the rim. It ends at `to` where it meets water. */
function course(
  cells: number[],
  from: number | undefined,
  to: number | undefined,
  map: WaterMap,
  env: Environment,
  width: (cell: number) => number,
): CoursePoint[] {
  // Water running along the glass stays clear of it, so all of it shows.
  let points = cells.map((cell) => {
    const { x, z } = cellCenter(cell, map, env);
    const half = width(cell) / 2;
    return {
      x: clamp(x, half - env.width / 2, env.width / 2 - half),
      z: clamp(z, half - env.depth / 2, env.depth / 2 - half),
      width: width(cell),
    };
  });
  // Cells beside each other along the glass can land on the same spot.
  points = points.filter(
    (point, i) =>
      i === 0 ||
      Math.hypot(point.x - points[i - 1].x, point.z - points[i - 1].z) > 1e-6,
  );
  // Bends wide enough that the stream's inner edge doesn't fold over itself.
  const widest = Math.max(...points.map((point) => point.width));
  for (let pass = 0; pass < (widest / CELL) ** 2 / 2; pass++)
    points = relaxed(points);
  for (let pass = 0; pass < 2; pass++) points = rounded(points);
  const rim = (from ?? -Infinity) + STREAM_DEPTH / 2;
  let surface = from === undefined ? Infinity : rim,
    along = 0;
  return points.map((point, i) => {
    if (i > 0)
      along += Math.hypot(point.x - points[i - 1].x, point.z - points[i - 1].z);
    surface = Math.min(
      surface,
      Math.max(rim, groundHeight(point.x, point.z, env) + STREAM_DEPTH),
    );
    const y = i === points.length - 1 && to !== undefined ? to : surface;
    return { ...point, y: Math.max(y, to ?? -Infinity), along };
  });
}

type PathPoint = { x: number; z: number; width: number };

/** Each point moved halfway toward the middle of its neighbors, keeping both
 * ends where they are. */
function relaxed(points: PathPoint[]): PathPoint[] {
  return points.map((point, i) => {
    if (i === 0 || i === points.length - 1) return point;
    const before = points[i - 1],
      after = points[i + 1];
    return {
      x: (before.x + 2 * point.x + after.x) / 4,
      z: (before.z + 2 * point.z + after.z) / 4,
      width: point.width,
    };
  });
}

/** Chaikin's corner cutting, keeping both ends where they are. */
function rounded(points: PathPoint[]): PathPoint[] {
  if (points.length < 3) return points;
  const mix = (a: PathPoint, b: PathPoint, t: number) => ({
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    width: a.width + (b.width - a.width) * t,
  });
  const out = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    out.push(mix(points[i], points[i + 1], 0.25));
    out.push(mix(points[i], points[i + 1], 0.75));
  }
  out.push(points[points.length - 1]);
  return out;
}

/** A binary min-heap of cell indexes by height. */
class Heap {
  private readonly cells: number[] = [];
  private readonly heights: number[] = [];
  get size() {
    return this.cells.length;
  }
  push(cell: number, height: number) {
    let i = this.cells.length;
    this.cells.push(cell);
    this.heights.push(height);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (this.heights[up] <= height) break;
      this.cells[i] = this.cells[up];
      this.heights[i] = this.heights[up];
      i = up;
    }
    this.cells[i] = cell;
    this.heights[i] = height;
  }
  pop(): number {
    const top = this.cells[0];
    const cell = this.cells.pop()!,
      height = this.heights.pop()!;
    const size = this.cells.length;
    if (size) {
      let i = 0;
      for (;;) {
        const left = 2 * i + 1,
          right = left + 1;
        let smallest = i,
          lowest = height;
        if (left < size && this.heights[left] < lowest) {
          smallest = left;
          lowest = this.heights[left];
        }
        if (right < size && this.heights[right] < lowest) smallest = right;
        if (smallest === i) break;
        this.cells[i] = this.cells[smallest];
        this.heights[i] = this.heights[smallest];
        i = smallest;
      }
      this.cells[i] = cell;
      this.heights[i] = height;
    }
    return top;
  }
}
