import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Environment } from "../model/schema";
import { groundHeight } from "../model/terrain";

export function TerrainBrushCursor({
  x,
  z,
  radius,
  environment: env,
}: {
  x: number;
  z: number;
  radius: number;
  environment: Environment;
}) {
  const geometry = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 64 }, (_, index) => {
          const angle = (index / 64) * Math.PI * 2,
            px = x + Math.cos(angle) * radius,
            pz = z + Math.sin(angle) * radius;
          return new THREE.Vector3(
            px,
            Math.max(env.water, groundHeight(px, pz, env)) + 0.025,
            pz,
          );
        }),
      ),
    [x, z, radius, env],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineLoop geometry={geometry} renderOrder={6}>
      <lineBasicMaterial
        color="#e3f3ab"
        transparent
        opacity={0.85}
        depthTest={false}
      />
    </lineLoop>
  );
}
