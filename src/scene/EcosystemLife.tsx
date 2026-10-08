import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { EcosystemController } from "../simulation/useEcosystem";
import * as THREE from "three";
import type { Vec3 } from "../simulation/types";
import { assets, isAnimal } from "../assets";
import { juvenileScale } from "../simulation/lifeCycle";
import { swimmingHeight } from "../model/terrain";
import type { Environment } from "../model/schema";
import type { FoliageVisitor } from "./foliageMotion";

export function EcosystemLife({
  ecosystem,
  environment,
  foliageVisitors,
  paused,
  heldId,
}: {
  ecosystem: EcosystemController;
  environment: Environment;
  foliageVisitors: RefObject<FoliageVisitor[]>;
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
    if (document.hidden) return;
    const live = ecosystem.live.current!;
    const visitors = foliageVisitors.current;
    let count = 0;
    // Reuse one visitor buffer across plants, after the simulation has advanced.
    for (const animal of live.world.objects) {
      if (!isAnimal(animal.kind)) continue;
      const state = live.engine.observeRenderedAnimal(animal.id);
      const swimmer = state ? undefined : live.fish.get(animal.id, environment);
      if (!state && !swimmer) continue;
      const visitor = (visitors[count++] ??= {
        position: { x: 0, y: 0, z: 0 },
        radius: 0,
      });
      if (state) {
        visitor.position.x = state.position.x;
        visitor.position.y = state.position.y + state.motion.lift;
        visitor.position.z = state.position.z;
      } else if (swimmer) {
        visitor.position.x = swimmer.x;
        visitor.position.y =
          swimmer.y ??
          swimmingHeight(
            swimmer.x,
            swimmer.z,
            environment,
            assets[animal.kind].swims!.depth,
          );
        visitor.position.z = swimmer.z;
      }
      visitor.perchedOn =
        state?.surface === "leaf" && !state.motion.hop
          ? live.engine.graph.node(state.nodeId).plantId
          : undefined;
      visitor.radius =
        assets[animal.kind].radius * animal.scale * juvenileScale(animal);
    }
    visitors.length = count;
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
