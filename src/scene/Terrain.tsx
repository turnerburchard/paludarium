import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Environment } from "../model/schema";
import { surfaceGrid, type Terrain as TerrainData } from "../model/terrainData";
import { changedArea, drawTerrain, hash, makeTerrain } from "./groundSurface";
import { groundHeight, hasDryGround } from "../model/terrain";
import { makeWaterMaterial } from "./waterMaterial";
import { makeGroundMoss } from "./groundMoss";
import { groundScatter, makeLeafGeometry, scatterSpots } from "./groundScatter";

const soilColors = ["#4a3d2e", "#544534", "#423527", "#5d4c38"].map(
  (hex) => new THREE.Color(hex),
);
/** Soil seen through the glass is split into rows about this tall. */
const SOIL_ROW = 0.07;

/** The soil seen through the glass, as uneven low-poly facets. */
function makeSkirt(env: Environment) {
  const positions: number[] = [],
    colors: number[] = [];
  const color = new THREE.Color();
  const { columns, rows } = surfaceGrid(env);
  const x = env.width / 2,
    z = env.depth / 2;
  // Each wall is split like the ground's edge so its top meets the surface.
  const walls = [
    { from: [-x, -z], to: [x, -z], segments: columns },
    { from: [x, -z], to: [x, z], segments: rows },
    { from: [x, z], to: [-x, z], segments: columns },
    { from: [-x, z], to: [-x, -z], segments: rows },
  ];
  for (const { from, to, segments } of walls) {
    const at = (t: number, y: number) =>
      new THREE.Vector3(
        THREE.MathUtils.lerp(from[0], to[0], t),
        y,
        THREE.MathUtils.lerp(from[1], to[1], t),
      );
    const ground = (t: number) => {
      const { x, z } = at(t, 0);
      return groundHeight(x, z, env);
    };
    let highest = 0;
    for (let i = 0; i <= segments; i++)
      highest = Math.max(highest, ground(i / segments));
    const soilRows = Math.max(1, Math.ceil(highest / SOIL_ROW));
    // Rows follow the surface like strata. Inside points shift a little so
    // the facets look loose and uneven, but the corners, the bottom and the
    // top edge stay put so the walls meet cleanly.
    const point = (i: number, row: number) => {
      const t = i / segments,
        top = ground(t);
      let y = (top * row) / soilRows,
        shift = 0;
      if (row > 0 && row < soilRows) {
        y += (hash(t * 31, row) - 0.5) * 0.5 * (top / soilRows);
        if (i > 0 && i < segments) shift = (hash(row, t * 17) - 0.5) * 0.6;
      }
      return at((i + shift) / segments, y);
    };
    for (let i = 0; i < segments; i++) {
      for (let row = 0; row < soilRows; row++) {
        const a = point(i, row),
          b = point(i + 1, row),
          c = point(i, row + 1),
          d = point(i + 1, row + 1);
        for (const triangle of [
          [a, c, b],
          [b, c, d],
        ]) {
          const middle = triangle[0].clone().add(triangle[1]).add(triangle[2]);
          color
            .copy(
              soilColors[
                Math.floor(
                  hash(middle.x + middle.z, middle.y) * soilColors.length,
                )
              ],
            )
            .multiplyScalar(0.92 + 0.16 * hash(middle.y, middle.x - middle.z));
          for (const corner of triangle) {
            positions.push(corner.x, corner.y, corner.z);
            colors.push(color.r, color.g, color.b);
          }
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
export function Terrain({
  environment: env,
  groundRef,
}: {
  environment: Environment;
  groundRef: RefObject<THREE.Mesh | null>;
}) {
  const pebbles = useRef<THREE.InstancedMesh>(null);
  const heights = env.terrain?.heights;
  const surface = useMemo(
    () => makeTerrain(env),
    [env.width, env.depth, env.height, env.substrate],
  );
  const drawn = useRef<{
    surface: THREE.BufferGeometry;
    terrain?: TerrainData;
  }>(null);
  useLayoutEffect(() => {
    const before = drawn.current;
    drawn.current = { surface, terrain: env.terrain };
    if (before?.surface !== surface) drawTerrain(surface, env);
    else if (before.terrain !== env.terrain)
      drawTerrain(surface, env, changedArea(before.terrain, env));
  }, [surface, env.terrain]);
  const skirt = useMemo(
    () => makeSkirt(env),
    [env.width, env.depth, env.height, env.substrate, heights],
  );
  const scatter = useMemo(
    () => groundScatter(env),
    [env.width, env.depth, env.height, env.substrate, env.terrain],
  );
  const capacity = scatterSpots(env);
  const leaves = useRef<THREE.InstancedMesh>(null),
    chips = useRef<THREE.InstancedMesh>(null);
  const leafShape = useMemo(makeLeafGeometry, []);
  useEffect(() => () => leafShape.dispose(), [leafShape]);
  useEffect(() => {
    for (const [kind, mesh] of [
      ["leaf", leaves.current],
      ["chip", chips.current],
      ["pebble", pebbles.current],
    ] as const) {
      if (!mesh) continue;
      const pieces = scatter.filter((piece) => piece.kind === kind);
      pieces.forEach((piece, index) => {
        mesh.setMatrixAt(index, piece.matrix);
        mesh.setColorAt(index, piece.color);
      });
      mesh.count = pieces.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [scatter]);
  const carpet = useMemo(
    () => makeGroundMoss(env),
    [env.width, env.depth, env.height, env.substrate, env.terrain, env.water],
  );
  useEffect(() => () => surface.dispose(), [surface]);
  useEffect(() => () => skirt.dispose(), [skirt]);
  useEffect(() => () => carpet?.dispose(), [carpet]);
  return (
    <group>
      <mesh ref={groundRef} geometry={surface} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      <mesh geometry={skirt}>
        <meshStandardMaterial
          vertexColors
          roughness={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      {carpet && (
        <mesh geometry={carpet} receiveShadow>
          <meshStandardMaterial vertexColors flatShading roughness={1} />
        </mesh>
      )}
      <instancedMesh ref={pebbles} args={[undefined, undefined, capacity]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={leaves}
        args={[leafShape, undefined, capacity]}
        receiveShadow
      >
        <meshStandardMaterial roughness={0.9} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh
        ref={chips}
        args={[undefined, undefined, capacity]}
        receiveShadow
      >
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
  material.opacity = hasDryGround(env) ? 0.47 : 0.22;
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
            // Unit-high planes scaled to the level, so dragging it doesn't
            // rebuild their geometry every step.
            scale={[1, env.water, 1]}
            renderOrder={3}
          >
            <planeGeometry args={[env.width - 0.015, 1]} />
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
            scale={[1, env.water, 1]}
            renderOrder={3}
          >
            <planeGeometry args={[env.depth - 0.015, 1]} />
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

export function Tank({ environment: env }: { environment: Environment }) {
  const h = env.height,
    w = env.width,
    d = env.depth;
  const edges = useMemo(
    () =>
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.055, h, d + 0.055)),
    [w, d, h],
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
