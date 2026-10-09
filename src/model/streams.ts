import type { Environment, Stream } from "./schema";
import { groundHeight } from "./terrain";

/** Running water this deep over its bed. */
export const STREAM_DEPTH = 0.04;
/** A course gets a point about this often along its path. */
const STEP = 0.05;

export interface CoursePoint {
  x: number;
  z: number;
  /** The water's surface. */
  y: number;
  /** Distance along the path from the source. */
  along: number;
}

/** The path in tank coordinates. */
function tankPath(stream: Stream, env: Environment) {
  return stream.path.map(([u, v]) => [u * env.width, v * env.depth]);
}

/** Where a stream's water runs: down its path from the source, a little
 * above the bed, until it reaches the pool. Water never runs uphill, so
 * where the bed rises the surface keeps its level and runs under the rise. */
export function streamCourse(stream: Stream, env: Environment): CoursePoint[] {
  const path = tankPath(stream, env);
  const course: CoursePoint[] = [];
  let surface = Infinity,
    along = 0;
  for (let i = 1; i < path.length; i++) {
    const [x0, z0] = path[i - 1],
      [x1, z1] = path[i];
    const length = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(length / STEP));
    for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
      const t = s / steps,
        x = x0 + (x1 - x0) * t,
        z = z0 + (z1 - z0) * t;
      surface = Math.min(surface, groundHeight(x, z, env) + STREAM_DEPTH);
      if (surface <= env.water) {
        course.push({ x, z, y: env.water, along: along + length * t });
        return course;
      }
      course.push({ x, z, y: surface, along: along + length * t });
    }
    along += length;
  }
  return course;
}

/** Looks up the surface of the stream running over a spot, or within
 * `bank` of its edge, or null where there's none. */
export function streamSurface(env: Environment, bank = 0) {
  const courses = env.streams.map((stream) => ({
    course: streamCourse(stream, env),
    reach: stream.width / 2 + bank,
  }));
  return (x: number, z: number): number | null => {
    let nearest = Infinity,
      surface: number | null = null;
    for (const { course, reach } of courses)
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
        if (distance <= reach && distance < nearest) {
          nearest = distance;
          surface = a.y + (b.y - a.y) * t;
        }
      }
    return surface;
  };
}
