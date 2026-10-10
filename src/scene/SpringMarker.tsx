import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Environment, Spring } from "../model/schema";
import { groundHeight } from "../model/terrain";

const STONES = 6;

/** Where a spring wells up: a ring of stones around water bubbling out.
 * The ring is wider the more water comes up. */
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
  const radius = 0.05 + 0.06 * spring.flow;
  const bubble = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const swell = 1 + 0.18 * Math.sin(t * 7) * Math.sin(t * 3);
    bubble.current?.scale.set(
      radius * swell,
      radius * 0.45 * swell,
      radius * swell,
    );
  });
  return (
    <group position={[x, groundHeight(x, z, env), z]} onClick={onSelect}>
      {Array.from({ length: STONES }, (_, i) => {
        const angle = (i / STONES) * Math.PI * 2 + i * 0.4;
        const size = 0.022 + 0.01 * ((i * 7) % 3);
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius * 1.25,
              size * 0.4,
              Math.sin(angle) * radius * 1.25,
            ]}
            rotation={[i, i * 2, 0]}
            scale={size}
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
      <mesh ref={bubble} position={[0, 0.01, 0]} renderOrder={2}>
        <sphereGeometry args={[1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#e6f4f0"
          transparent
          opacity={0.75}
          roughness={0.2}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
