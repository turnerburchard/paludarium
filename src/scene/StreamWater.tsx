import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Environment, Stream } from "../model/schema";
import { streamCourse, type CoursePoint } from "../model/streams";

/** How fast water runs on the flat, and how much faster down a fall. */
const FLAT_SPEED = 0.3;
const FALL_SPEED = 1.6;
/** Drop over run where water starts to break up, and where it is all white. */
const RAPID_SLOPE = 0.2;
const FALL_SLOPE = 0.8;
/** How far white water carries past the foot of a fall. */
const FOAM_REACH = 0.3;
/** Distance over which the water fades in at its source and out into the pool. */
const FADE = 0.2;

/** A ribbon along the stream's course, flat across like a water surface.
 * Each vertex carries how far the water has travelled in time rather than
 * distance, so ripples scroll faster down falls without stretching. */
function streamGeometry(course: CoursePoint[], width: number) {
  const positions: number[] = [],
    flow: number[] = [],
    foam: number[] = [],
    fade: number[] = [],
    indices: number[] = [];
  const end = course.at(-1)!.along;
  let travel = 0,
    white = 0;
  course.forEach((point, i) => {
    const before = course[Math.max(0, i - 1)],
      after = course[Math.min(course.length - 1, i + 1)];
    const dx = after.x - before.x,
      dz = after.z - before.z;
    const length = Math.hypot(dx, dz);
    const side = { x: -dz / length, z: dx / length };
    if (i > 0) {
      const run = point.along - before.along,
        drop = before.y - point.y;
      const steep = Math.min(
        1,
        Math.max(0, (drop / run - RAPID_SLOPE) / (FALL_SLOPE - RAPID_SLOPE)),
      );
      white = Math.max(steep, white * Math.exp(-run / FOAM_REACH));
      travel +=
        Math.hypot(run, drop) /
        (FLAT_SPEED + (FALL_SPEED - FLAT_SPEED) * steep);
    }
    const alpha = Math.min(1, point.along / FADE, (end - point.along) / FADE);
    for (const across of [-1, 1]) {
      positions.push(
        point.x + (side.x * across * width) / 2,
        point.y,
        point.z + (side.z * across * width) / 2,
      );
      flow.push((across + 1) / 2, travel);
      foam.push(white);
      fade.push(alpha);
    }
    if (i > 0) {
      const a = 2 * (i - 1);
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("flow", new THREE.Float32BufferAttribute(flow, 2));
  geometry.setAttribute("foam", new THREE.Float32BufferAttribute(foam, 1));
  geometry.setAttribute("fade", new THREE.Float32BufferAttribute(fade, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function StreamWater({
  stream,
  environment: env,
  material,
}: {
  stream: Stream;
  environment: Environment;
  material: THREE.Material;
}) {
  const geometry = useMemo(() => {
    const course = streamCourse(stream, env);
    return course.length > 1 ? streamGeometry(course, stream.width) : null;
  }, [stream, env]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} renderOrder={2} />;
}
