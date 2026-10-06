import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Environment } from "../model/schema";
import { randomFromSeed } from "../model/random";
import { groundHeight } from "../model/terrain";

function makeTerrain(env: Environment) {
  const geo = new THREE.PlaneGeometry(env.width, env.depth, 70, 48);
  geo.rotateX(-Math.PI / 2);
  const p = geo.getAttribute("position"),
    colors = [];
  const soil = new THREE.Color("#443c2b"),
    sand = new THREE.Color("#a5936a");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      h = groundHeight(x, z, env);
    p.setY(i, h);
    const color = soil
      .clone()
      .lerp(sand, THREE.MathUtils.clamp((0.55 - h) * 2.3, 0, 1));
    color.multiplyScalar(0.94 + 0.09 * Math.sin(x * 29) * Math.sin(z * 37));
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
function makeSkirt(env: Environment) {
  const vertices: number[] = [],
    indices: number[] = [];
  const corners = [
    [-env.width / 2, -env.depth / 2],
    [env.width / 2, -env.depth / 2],
    [env.width / 2, env.depth / 2],
    [-env.width / 2, env.depth / 2],
    [-env.width / 2, -env.depth / 2],
  ];
  for (let edge = 0; edge < 4; edge++) {
    // Match surface subdivisions so the bank and sidewall share their silhouette.
    const segments = edge % 2 === 0 ? 70 : 48;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments,
        x = THREE.MathUtils.lerp(corners[edge][0], corners[edge + 1][0], t),
        z = THREE.MathUtils.lerp(corners[edge][1], corners[edge + 1][1], t);
      const n = vertices.length / 3;
      vertices.push(x, 0, z, x, groundHeight(x, z, env), z);
      if (i < segments) indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
export function Terrain({ environment: env }: { environment: Environment }) {
  const surface = useMemo(
    () => makeTerrain(env),
    [env.width, env.depth, env.substrate],
  );
  const skirt = useMemo(
    () => makeSkirt(env),
    [env.width, env.depth, env.substrate],
  );
  const stones = useMemo(() => {
    const random = randomFromSeed(84);
    return Array.from({ length: 160 }, () => ({
      x: (random() - 0.5) * (env.width - 0.1),
      z: (random() - 0.5) * (env.depth - 0.1),
      size: 0.013 + random() * 0.035,
    }));
  }, [env.width, env.depth]);
  useEffect(
    () => () => {
      surface.dispose();
      skirt.dispose();
    },
    [surface, skirt],
  );
  return (
    <group>
      <mesh geometry={surface} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      <mesh geometry={skirt}>
        <meshStandardMaterial
          color="#443829"
          roughness={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      {stones.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, groundHeight(s.x, s.z, env) + 0.005, s.z]}
          scale={[s.size, s.size * 0.5, s.size]}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? "#c4b991" : "#867c5b"}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}
export function Water({
  environment: env,
  paused,
}: {
  environment: Environment;
  paused: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null),
    time = useRef(0);
  useFrame((_, dt) => {
    if (paused || !ref.current) return;
    time.current += Math.min(dt, 0.05);
    const p = ref.current.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i);
      p.setZ(
        i,
        Math.sin(x * 5 + time.current * 1.1) *
          Math.cos(y * 4 + time.current * 0.7) *
          0.008,
      );
    }
    p.needsUpdate = true;
    ref.current.geometry.computeVertexNormals();
  });
  if (env.water <= 0) return null;
  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, env.water, 0]}
      receiveShadow
      renderOrder={2}
    >
      <planeGeometry args={[env.width - 0.015, env.depth - 0.015, 40, 28]} />
      <meshStandardMaterial
        color="#60adab"
        transparent
        opacity={0.47}
        roughness={0.18}
        metalness={0.2}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
export function Tank({ environment: env }: { environment: Environment }) {
  const h = 2.9,
    w = env.width,
    d = env.depth;
  const edges = useMemo(
    () =>
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.055, h, d + 0.055)),
    [w, d],
  );
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <group>
      <mesh position={[0, -0.11, 0]} receiveShadow castShadow>
        <boxGeometry args={[w + 0.17, 0.18, d + 0.17]} />
        <meshStandardMaterial color="#253c36" roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.035, 0]}>
        <boxGeometry args={[w + 0.08, 0.035, d + 0.08]} />
        <meshStandardMaterial color="#86b3a8" metalness={0.3} roughness={0.2} />
      </mesh>
      {/* Offset glass from the soil faces to avoid coplanar depth flicker. */}
      {[
        [-w / 2 - 0.025, h / 2, 0],
        [w / 2 + 0.025, h / 2, 0],
      ].map((p, i) => (
        <mesh
          key={i}
          position={p as [number, number, number]}
          rotation={[0, Math.PI / 2, 0]}
          renderOrder={4}
        >
          <planeGeometry args={[d, h]} />
          <meshPhysicalMaterial
            color="#b5d8cc"
            transparent
            opacity={0.045}
            roughness={0.12}
            metalness={0.05}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {[-d / 2 - 0.025, d / 2 + 0.025].map((z) => (
        <mesh key={z} position={[0, h / 2, z]} renderOrder={4}>
          <planeGeometry args={[w, h]} />
          <meshPhysicalMaterial
            color="#b5d8cc"
            transparent
            opacity={0.035}
            roughness={0.12}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <lineSegments geometry={edges} position={[0, h / 2, 0]}>
        <lineBasicMaterial color="#acd0c4" transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}
