import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TANK_HEIGHT, type Environment } from "../model/schema";
import { randomFromSeed } from "../model/random";
import { terrainSamples } from "../model/terrainData";
import { groundHeight, MAX_GROUND_HEIGHT } from "../model/terrain";
import { makeWaterMaterial } from "./waterMaterial";
import { disposeAsset } from "../assets";
import { buildBackdrop } from "../assets/landscape/backdrop";

function makeTerrain(env: Environment) {
  const geo = new THREE.PlaneGeometry(env.width, env.depth, 70, 48);
  geo.rotateX(-Math.PI / 2);
  const p = geo.getAttribute("position"),
    colors = [];
  const soil = new THREE.Color("#443c2b"),
    sand = new THREE.Color("#a5936a");
  const palette = { soil, sand, stone: new THREE.Color("#867c5b") };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      h = groundHeight(x, z, env);
    p.setY(i, h);
    const color = soil
      .clone()
      .lerp(sand, THREE.MathUtils.clamp((0.55 - h) * 2.3, 0, 1));
    if (env.terrain) {
      const natural = color.clone();
      color.setRGB(0, 0, 0);
      for (const { index, weight } of terrainSamples(x, z, env)) {
        const material = env.terrain.paint[index];
        const source = material === "natural" ? natural : palette[material];
        color.r += source.r * weight;
        color.g += source.g * weight;
        color.b += source.b * weight;
      }
    }
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
  const pebbles = useRef<THREE.InstancedMesh>(null);
  const surface = useMemo(
    () => makeTerrain(env),
    [env.width, env.depth, env.substrate, env.terrain],
  );
  const skirt = useMemo(
    () => makeSkirt(env),
    [env.width, env.depth, env.substrate, env.terrain],
  );
  const stones = useMemo(() => {
    const random = randomFromSeed(84);
    return Array.from({ length: 160 }, () => ({
      x: (random() - 0.5) * (env.width - 0.1),
      z: (random() - 0.5) * (env.depth - 0.1),
      size: 0.013 + random() * 0.035,
    }));
  }, [env.width, env.depth]);
  useEffect(() => {
    const mesh = pebbles.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    const pale = new THREE.Color("#c4b991"),
      dark = new THREE.Color("#867c5b");
    stones.forEach((stone, index) => {
      transform.position.set(
        stone.x,
        groundHeight(stone.x, stone.z, env) + 0.005,
        stone.z,
      );
      transform.scale.set(stone.size, stone.size * 0.5, stone.size);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, index % 3 === 0 ? pale : dark);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [stones, env.width, env.depth, env.substrate, env.terrain]);
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
      <instancedMesh ref={pebbles} args={[undefined, undefined, stones.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
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
  const time = useRef({ value: 0 });
  const material = useMemo(() => makeWaterMaterial(time.current), []);
  material.opacity = env.water > MAX_GROUND_HEIGHT ? 0.22 : 0.47;
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    if (!paused) time.current.value += Math.min(dt, 0.05);
  });
  if (env.water <= 0) return null;
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[0, env.water / 2, side * (env.depth / 2 - 0.008)]}
            renderOrder={3}
          >
            <planeGeometry args={[env.width - 0.015, env.water]} />
            <meshBasicMaterial
              color="#60adab"
              transparent
              opacity={0.07}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh
            position={[side * (env.width / 2 - 0.008), env.water / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
            renderOrder={3}
          >
            <planeGeometry args={[env.depth - 0.015, env.water]} />
            <meshBasicMaterial
              color="#60adab"
              transparent
              opacity={0.07}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
      <mesh
        material={material}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, env.water, 0]}
        receiveShadow
        renderOrder={2}
      >
        <planeGeometry args={[env.width - 0.015, env.depth - 0.015, 40, 28]} />
      </mesh>
    </group>
  );
}

/** The wall over the back glass, when the habitat has one. */
export function Backdrop({ environment: env }: { environment: Environment }) {
  const { width, depth, backdrop } = env;
  const model = useMemo(
    () => backdrop && buildBackdrop(width, TANK_HEIGHT, backdrop),
    [width, backdrop],
  );
  useEffect(() => () => model && disposeAsset(model), [model]);
  return model ? (
    <primitive object={model} position={[0, 0, -depth / 2]} />
  ) : null;
}

export function Tank({ environment: env }: { environment: Environment }) {
  const h = TANK_HEIGHT,
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
