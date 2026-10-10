import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Environment, Spring } from "../model/schema";
import { groundHeight } from "../model/terrain";
import {
  STREAM_DEPTH,
  springOutlet,
  springRadius,
  stillSurface,
} from "../model/water";

const STONES = 6;
/** The opening in the ring of stones where the stream runs out. */
const OUTLET = 1.4;
/** Rings spreading at once, and how many times a second the spring surges
 * and sends a new one out. */
const RIPPLES = 3;
const SURGES = 2;
/** Bubbles at a trickle, plus more as the flow picks up. */
const BUBBLES = 3;
const MORE_BUBBLES = 6;
/** How far the pool reaches past the spring, and the outer part of it that
 * thins out so it meets the ground softly, like a stream's edge. */
const POOL = 1.2;
const POOL_EDGE = 0.35;
const WATER = "#60adab";
const WELLING = "#a9dcd4";
const FOAM = "#e6f4f0";

/** Where a spring wells up: a ring of stones around a little pool. Bubbles
 * rise through it and pop, and the middle surges, sending ripples out. The
 * ring is wider the more water comes up. The pool lies at a stream's depth,
 * so the stream runs straight out of it through a gap in the stones. */
export function SpringMarker({
  spring,
  environment: env,
  paused,
  selected,
  onSelect,
}: {
  spring: Spring;
  environment: Environment;
  paused: boolean;
  selected: boolean;
  onSelect: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const x = spring.x * env.width,
    z = spring.z * env.depth;
  const radius = springRadius(spring.flow);
  const outlet = springOutlet(spring, env);
  const ground = groundHeight(x, z, env);
  // Under a pool or the tank's water, the spring boils up at its surface.
  const depth = Math.max(STREAM_DEPTH, stillSurface(x, z, env) - ground);
  const bubbleCount = BUBBLES + Math.round(MORE_BUBBLES * spring.flow);
  const pool = useMemo(() => poolGeometry(radius * POOL), [radius]);
  useEffect(() => () => pool.dispose(), [pool]);
  const time = useRef(0);
  const boil = useRef<THREE.Mesh>(null);
  const ripples = useRef<(THREE.Mesh | null)[]>([]);
  const rippleFades = useRef<(THREE.Material | null)[]>([]);
  useFrame((_, dt) => {
    if (!paused) time.current += Math.min(dt, 0.05);
    const t = time.current;
    // Each surge peaks just as a ripple leaves the middle.
    const surge = 0.5 + 0.5 * Math.cos(t * SURGES * Math.PI * 2);
    boil.current?.scale.set(
      radius * (0.28 + 0.08 * surge),
      radius * (0.04 + 0.14 * surge * surge),
      radius * (0.28 + 0.08 * surge),
    );
    for (let i = 0; i < RIPPLES; i++) {
      const age = ((t * SURGES) / RIPPLES + i / RIPPLES) % 1;
      ripples.current[i]?.scale.setScalar(radius * (0.25 + 0.95 * age));
      const fade = rippleFades.current[i];
      if (fade) fade.opacity = 0.6 * (1 - age) ** 1.5;
    }
  });
  return (
    <group position={[x, ground, z]} onClick={onSelect}>
      {Array.from({ length: STONES }, (_, i) => {
        const angle =
          outlet === undefined
            ? (i / STONES) * Math.PI * 2 + i * 0.4
            : outlet + OUTLET / 2 + (i / (STONES - 1)) * (Math.PI * 2 - OUTLET);
        const size = radius * (0.28 + 0.08 * ((i * 7) % 3));
        const sx = Math.cos(angle) * radius * 1.3,
          sz = Math.sin(angle) * radius * 1.3;
        // Each stone sits on its own ground, which can fall away on a slope.
        const below = ground - groundHeight(x + sx, z + sz, env);
        return (
          <mesh
            key={i}
            // Resting on the ground. A big spring's stones stand out of the water.
            position={[sx, size * 1.2 - below, sz]}
            rotation={[0.2 * (i % 2), i * 2, 0]}
            scale={[size, size * 1.5, size]}
            castShadow
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={selected ? "#e8edc3" : "#77736a"}
              roughness={0.9}
              flatShading
            />
          </mesh>
        );
      })}
      {depth === STREAM_DEPTH && (
        <mesh
          geometry={pool}
          position={[0, STREAM_DEPTH, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={2}
        >
          <meshStandardMaterial
            color={WATER}
            vertexColors
            transparent
            opacity={0.6}
            roughness={0.18}
            metalness={0.2}
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh ref={boil} position={[0, depth, 0]} renderOrder={3}>
        <sphereGeometry args={[1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={WELLING}
          transparent
          opacity={0.45}
          roughness={0.15}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: RIPPLES }, (_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            ripples.current[i] = mesh;
          }}
          position={[0, depth + 0.002, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={3}
        >
          <ringGeometry args={[0.88, 1, 32]} />
          <meshBasicMaterial
            ref={(material) => {
              rippleFades.current[i] = material;
            }}
            color={FOAM}
            transparent
            depthWrite={false}
          />
        </mesh>
      ))}
      {Array.from({ length: bubbleCount }, (_, i) => (
        <Bubble key={i} index={i} radius={radius} depth={depth} time={time} />
      ))}
    </group>
  );
}

/** A flat disc of water whose outer edge fades out through its vertex alpha. */
function poolGeometry(radius: number) {
  const geometry = new THREE.RingGeometry(0, radius, 32, 4);
  const position = geometry.getAttribute("position");
  const colors: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const out = Math.hypot(position.getX(i), position.getY(i)) / radius;
    colors.push(1, 1, 1, Math.min(1, (1 - out) / POOL_EDGE));
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  return geometry;
}

/** One bubble coming up from the spring's bed, swelling as it rises, then
 * popping into a little ring on the surface. Each comes up in its own
 * rhythm, somewhere new each time. */
function Bubble({
  index,
  radius,
  depth,
  time,
}: {
  index: number;
  radius: number;
  depth: number;
  time: RefObject<number>;
}) {
  const bubble = useRef<THREE.Mesh>(null);
  const pop = useRef<THREE.Mesh>(null);
  const popFade = useRef<THREE.MeshBasicMaterial>(null);
  const period = 0.9 + 0.23 * (index % 4);
  useFrame(() => {
    const cycle = time.current / period + index * 0.37;
    const age = cycle % 1;
    const angle = index * 2.4 + Math.floor(cycle) * 2.1;
    const out =
      radius * (0.1 + 0.55 * ((index * 0.61 + Math.floor(cycle) * 0.29) % 1));
    const spot = { x: Math.cos(angle) * out, z: Math.sin(angle) * out };
    // Rising for most of its life, then a quick pop.
    const rise = Math.min(1, age / 0.7);
    bubble.current?.position.set(
      spot.x,
      0.006 + (depth - 0.006) * rise,
      spot.z,
    );
    bubble.current?.scale.setScalar(
      age < 0.7 ? radius * (0.06 + 0.08 * rise) : 0,
    );
    const popped = Math.max(0, (age - 0.7) / 0.3);
    pop.current?.position.set(spot.x, depth + 0.003, spot.z);
    pop.current?.scale.setScalar(radius * (0.05 + 0.3 * popped));
    if (popFade.current)
      popFade.current.opacity = popped > 0 ? 0.8 * (1 - popped) : 0;
  });
  return (
    <>
      <mesh ref={bubble} renderOrder={3}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial
          color={FOAM}
          transparent
          opacity={0.85}
          roughness={0.1}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={pop} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.75, 1, 16]} />
        <meshBasicMaterial
          ref={popFade}
          color={FOAM}
          transparent
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
