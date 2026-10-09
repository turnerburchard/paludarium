import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Environment } from "../model/schema";
import { clamp, groundHeight } from "../model/terrain";
import { STREAM_DEPTH, type CoursePoint } from "../model/water";

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
/** Vertices across the stream, so its edges can follow the bed. */
const ACROSS = 7;
/** The outer part of each side, as a share of half the width, that fades
 * out so the water never ends in a hard line on a wide, flat bed. */
const EDGE = 0.25;

/** A ribbon along the stream's course. It lies on the bed rather than level
 * across, so it never hangs over a hollow or the low side of a slope.
 * Each vertex carries how far the water has travelled in time rather than
 * distance, so ripples scroll faster down falls without stretching. Where the
 * bed rises above the surface, or the ribbon nears its sides, the water fades
 * out, so it meets any bank softly. */
function streamGeometry(course: CoursePoint[], env: Environment) {
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
      const steep = clamp(
        (drop / run - RAPID_SLOPE) / (FALL_SLOPE - RAPID_SLOPE),
        0,
        1,
      );
      white = Math.max(steep, white * Math.exp(-run / FOAM_REACH));
      travel +=
        Math.hypot(run, drop) /
        (FLAT_SPEED + (FALL_SPEED - FLAT_SPEED) * steep);
    }
    const ends = Math.min(1, point.along / FADE, (end - point.along) / FADE);
    for (let j = 0; j < ACROSS; j++) {
      const across = (2 * j) / (ACROSS - 1) - 1;
      // Kept inside the glass where a stream runs along or off the tank's edge.
      const x = clamp(
          point.x + (side.x * across * point.width) / 2,
          -env.width / 2,
          env.width / 2,
        ),
        z = clamp(
          point.z + (side.z * across * point.width) / 2,
          -env.depth / 2,
          env.depth / 2,
        );
      const ground = groundHeight(x, z, env);
      const y = Math.min(point.y, ground + STREAM_DEPTH);
      positions.push(x, y, z);
      flow.push((across + 1) / 2, travel);
      foam.push(white);
      // Falling water leaves its bed, so white water keeps its body.
      const body = Math.max(clamp((y - ground) / STREAM_DEPTH, 0, 1), white);
      fade.push(Math.min(ends, body, (1 - Math.abs(across)) / EDGE));
    }
    if (i > 0) {
      const row = ACROSS * (i - 1);
      for (let j = 0; j < ACROSS - 1; j++) {
        const a = row + j,
          b = a + ACROSS;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
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
  course,
  environment: env,
  material,
}: {
  course: CoursePoint[];
  environment: Environment;
  material: THREE.Material;
}) {
  const geometry = useMemo(() => streamGeometry(course, env), [course, env]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} renderOrder={2} />;
}
