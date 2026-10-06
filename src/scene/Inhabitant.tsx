import type { EcosystemController } from "../simulation/useEcosystem";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { assets, buildAsset, disposeAsset, isFrog } from "../assets";
import type { Environment, HabitatObject } from "../model/schema";
import { groundHeight } from "../model/terrain";

interface Props {
  object: HabitatObject;
  environment: Environment;
  paused: boolean;
  selected?: boolean;
  ghost?: boolean;
  invalid?: boolean;
  ecosystem?: EcosystemController;
  onSelect?: (event: ThreeEvent<MouseEvent>) => void;
}
export function Inhabitant({
  object,
  environment,
  paused,
  selected = false,
  ghost = false,
  invalid = false,
  onSelect,
  ecosystem,
}: Props) {
  const root = useRef<THREE.Group>(null),
    clock = useRef(0);
  const model = useMemo(
    () => buildAsset(object.kind, object.seed),
    [object.kind, object.seed],
  );
  const frog = isFrog(object.kind);
  useEffect(() => () => disposeAsset(model), [model]);
  useEffect(() => {
    clock.current = 0;
  }, [object.x, object.z, environment]);
  useEffect(() => {
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          m.transparent = ghost;
          m.opacity = ghost ? 0.55 : 1;
        });
      }
    });
  }, [model, ghost]);
  const pose = useMemo(
    () => ({
      normal: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      back: new THREE.Vector3(),
      matrix: new THREE.Matrix4(),
      rotation: new THREE.Quaternion(),
    }),
    [],
  );
  const ground = groundHeight(object.x, object.z, environment);
  const baseY =
    object.kind === "fish"
      ? Math.max(ground + 0.08, environment.water - 0.14)
      : ground;
  useFrame((_, dt) => {
    const group = root.current;
    if (!group) return;
    if (!paused && !selected && !ghost) clock.current += Math.min(dt, 0.05);
    const t = clock.current;
    group.position.set(object.x, baseY, object.z);
    group.rotation.set(0, object.rotation, 0);
    if (frog && !ghost && ecosystem) {
      const state = ecosystem.live.current!.engine.observeAnimal(object.id);
      if (state) {
        group.position.set(
          state.position.x,
          state.position.y,
          state.position.z,
        );
        pose.normal
          .set(state.normal.x, state.normal.y, state.normal.z)
          .normalize();
        pose.forward.set(
          state.direction.x,
          state.direction.y,
          state.direction.z,
        );
        pose.forward.addScaledVector(
          pose.normal,
          -pose.forward.dot(pose.normal),
        );
        if (pose.forward.lengthSq() < 0.001)
          pose.forward.set(0, 0, -1).projectOnPlane(pose.normal);
        if (pose.forward.lengthSq() < 0.001)
          pose.forward.set(0, 1, 0).projectOnPlane(pose.normal);
        pose.back.copy(pose.forward).normalize().negate();
        pose.right.crossVectors(pose.normal, pose.back).normalize();
        pose.matrix.makeBasis(pose.right, pose.normal, pose.back);
        pose.rotation.setFromRotationMatrix(pose.matrix);
        group.quaternion.copy(pose.rotation);
        group.position.y += state.motion.lift;
        group.rotateX(state.motion.tilt);
        model.scale.y =
          state.activity === "sleeping" ? 0.92 : 1 + Math.sin(t * 2.5) * 0.01;
        return;
      }
    }
    if (ghost || selected) return;
    // A frog without a reachable surface remains idle at its saved placement.
    if (frog) {
      model.scale.y = 1;
      return;
    }
    if (object.kind === "fish") {
      const fish = ecosystem?.live.current!.fish.get(object.id);
      if (fish) {
        // Swim below the surface, but never sink into the ground.
        group.position.set(
          fish.x,
          Math.max(
            groundHeight(fish.x, fish.z, environment) + 0.05,
            environment.water - 0.13 + Math.sin(t * 1.3) * 0.025,
          ),
          fish.z,
        );
        group.rotation.y = fish.heading;
      }
      const tail = model.getObjectByName("tail");
      if (tail) tail.rotation.z = Math.sin(t * 9) * 0.3;
    } else if (assets[object.kind].category === "Plants") {
      group.rotation.z = Math.sin(t * 0.7 + object.seed) * 0.012;
    }
  });
  return (
    <group
      ref={root}
      position={[object.x, baseY, object.z]}
      rotation={[0, object.rotation, 0]}
      scale={object.scale}
      onClick={onSelect}
    >
      <primitive object={model} />
      {assets[object.kind].category === "Animals" && !ghost && (
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.29, 10, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {(selected || ghost) && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.012, 0]}
          renderOrder={6}
        >
          <ringGeometry
            args={[
              assets[object.kind].radius + 0.04,
              assets[object.kind].radius + 0.065,
              48,
            ]}
          />
          <meshBasicMaterial
            color={invalid ? "#ed8b79" : "#e3f3ab"}
            transparent
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
