import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { EcosystemController } from "../simulation/useEcosystem";
import * as THREE from "three";
import type { Vec3 } from "../simulation/types";

export function EcosystemLife({
  ecosystem,
  paused,
  heldId,
}: {
  ecosystem: EcosystemController;
  paused: boolean;
  heldId: string | null;
}) {
  const held = useMemo(() => new Set(heldId ? [heldId] : []), [heldId]);
  useFrame((_, dt) => {
    const { engine, fish } = ecosystem.live.current!;
    const stopped = paused || document.hidden;
    engine.advance(dt, stopped, held);
    fish.advance(dt, stopped, held);
    ecosystem.advanceLife(dt, stopped);
  }, -1);
  const engine = ecosystem.live.current!.engine;
  return (
    <group>
      {ecosystem.snapshot.food
        .filter((p) => p.amount > 0.01)
        .map((patch) => {
          const node = engine.graph.nodes.get(patch.nodeId);
          if (!node) return null;
          return (
            <Springtails
              key={patch.nodeId}
              position={node.position}
              paused={paused}
            />
          );
        })}
    </group>
  );
}

/** A small visual sample, independent of the habitat's population budget. */
function Springtails({
  position,
  paused,
}: {
  position: Vec3;
  paused: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const clock = useRef(0);
  const pose = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ camera }, dt) => {
    const group = mesh.current;
    if (!group) return;
    if (!paused && !document.hidden) clock.current += Math.min(dt, 0.05);
    group.visible = camera.position.distanceTo(group.position) < 5;
    if (!group.visible) return;
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.4 + clock.current * (0.25 + i * 0.03);
      pose.position.set(
        Math.cos(angle) * 0.1,
        0.006,
        Math.sin(angle * 1.3) * 0.1,
      );
      pose.rotation.y = angle;
      pose.scale.set(0.7, 0.55, 1.4);
      pose.updateMatrix();
      group.setMatrixAt(i, pose.matrix);
    }
    group.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 5]}
      position={[position.x, position.y, position.z]}
    >
      <sphereGeometry args={[0.012, 5, 3]} />
      <meshStandardMaterial color="#ddd8bf" roughness={0.9} />
    </instancedMesh>
  );
}
