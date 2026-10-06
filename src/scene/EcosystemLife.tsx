import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { EcosystemController } from "../simulation/useEcosystem";

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
            <group
              key={patch.nodeId}
              position={[
                node.position.x,
                node.position.y + 0.022,
                node.position.z,
              ]}
            >
              {Array.from(
                { length: Math.min(5, Math.ceil(patch.amount)) },
                (_, i) => (
                  <mesh
                    key={i}
                    position={[
                      Math.cos(i * 2.4) * 0.1,
                      0,
                      Math.sin(i * 2.4) * 0.1,
                    ]}
                  >
                    <sphereGeometry args={[0.025, 6, 4]} />
                    <meshStandardMaterial color="#c3a174" roughness={0.8} />
                  </mesh>
                ),
              )}
            </group>
          );
        })}
    </group>
  );
}
