import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Environment, Spring } from "../model/schema";
import { groundHeight } from "../model/terrain";
import { STREAM_DEPTH, springOutlet, springRadius } from "../model/water";

const STONES = 6;
/** The opening in the ring of stones where the stream runs out. */
const OUTLET = 1.4;
const RIPPLES = 3;
/** Bubbles at a trickle, plus more as the flow picks up. */
const BUBBLES = 3;
const MORE_BUBBLES = 6;
const WATER = "#60adab";
const FOAM = "#e6f4f0";

/** Where a spring wells up: a ring of stones around water bubbling out, with
 * ripples spreading from the middle. The ring is wider the more water comes
 * up. The water sits at a stream's depth, so the stream runs straight out. */
export function SpringMarker({
  spring,
  environment: env,
  selected,
  onSelect,
}: {
  spring: Spring;
  environment: Environment;
  selected: boolean;
  onSelect: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const x = spring.x * env.width,
    z = spring.z * env.depth;
  const radius = springRadius(spring.flow);
  const outlet = springOutlet(spring, env);
  const ground = groundHeight(x, z, env);
  const bubbleCount = BUBBLES + Math.round(MORE_BUBBLES * spring.flow);
  const boil = useRef<THREE.Mesh>(null);
  const ripples = useRef<(THREE.Mesh | null)[]>([]);
  const rippleFades = useRef<(THREE.Material | null)[]>([]);
  const bubbles = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const surge = 1 + 0.25 * Math.sin(t * 5) * Math.sin(t * 2.3);
    boil.current?.scale.set(radius * 0.5, radius * 0.18 * surge, radius * 0.5);
    for (let i = 0; i < RIPPLES; i++) {
      const age = (t * 0.7 + i / RIPPLES) % 1;
      ripples.current[i]?.scale.setScalar(radius * (0.3 + 0.8 * age));
      const fade = rippleFades.current[i];
      if (fade) fade.opacity = 0.45 * (1 - age);
    }
    bubbles.current.forEach((bubble, i) => {
      if (!bubble) return;
      // Each bubble comes up in its own spot and rhythm, swells, then pops.
      const period = 0.7 + 0.15 * (i % 3);
      const age = (t / period + i * 0.37) % 1;
      const angle = i * 2.4 + Math.floor(t / period + i * 0.37) * 1.7;
      const out = radius * (0.15 + 0.5 * ((i * 0.61) % 1)) * (0.6 + 0.6 * age);
      bubble.position.set(
        Math.cos(angle) * out,
        STREAM_DEPTH - 0.004 + 0.012 * age,
        Math.sin(angle) * out,
      );
      bubble.scale.setScalar(age < 0.85 ? radius * 0.22 * age : 0);
    });
  });
  return (
    <group position={[x, ground, z]} onClick={onSelect}>
      {Array.from({ length: STONES }, (_, i) => {
        const angle =
          outlet === undefined
            ? (i / STONES) * Math.PI * 2 + i * 0.4
            : outlet + OUTLET / 2 + (i / (STONES - 1)) * (Math.PI * 2 - OUTLET);
        const size = 0.022 + 0.007 * ((i * 7) % 3);
        const sx = Math.cos(angle) * radius * 1.3,
          sz = Math.sin(angle) * radius * 1.3;
        // Each stone sits on its own ground, which can fall away on a slope.
        const below = ground - groundHeight(x + sx, z + sz, env);
        return (
          <mesh
            key={i}
            // Standing from the ground up out of the water.
            position={[sx, STREAM_DEPTH - size * 0.7 - below, sz]}
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
      <mesh
        position={[0, STREAM_DEPTH, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <circleGeometry args={[radius * 1.15, 24]} />
        <meshStandardMaterial
          color={WATER}
          transparent
          opacity={0.55}
          roughness={0.18}
          metalness={0.2}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={boil} position={[0, STREAM_DEPTH, 0]} renderOrder={3}>
        <sphereGeometry args={[1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={FOAM}
          transparent
          opacity={0.5}
          roughness={0.2}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: RIPPLES }, (_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            ripples.current[i] = mesh;
          }}
          position={[0, STREAM_DEPTH + 0.002, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={3}
        >
          <ringGeometry args={[0.85, 1, 24]} />
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
        <mesh
          key={i}
          ref={(mesh) => {
            bubbles.current[i] = mesh;
          }}
          renderOrder={3}
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial
            color={FOAM}
            transparent
            opacity={0.85}
            roughness={0.1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
