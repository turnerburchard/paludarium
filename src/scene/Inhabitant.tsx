import type { EcosystemController } from "../simulation/useEcosystem";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  assets,
  buildAsset,
  categoryOf,
  disposeAsset,
  isAnimal,
  isLandAnimal,
} from "../assets";
import type { AssetKind, Environment, HabitatObject } from "../model/schema";
import { groundHeight, swimmingHeight } from "../model/terrain";
import { objectBase } from "../model/stacking";
import { FrogRig } from "./frogRig";
import { GeckoRig } from "./geckoRig";
import { lizardKinds } from "../assets/animals/lizards";
import { SnailRig } from "./snailRig";
import { ArthropodRig } from "./arthropodRig";
import { arthropodRigs } from "../assets/animals/arthropods";
import { TurtleRig } from "./turtleRig";
import { SwimRig } from "./swimRig";
import { barbSwim } from "../assets/animals/barb";
import { SWIM_BOB } from "../simulation/swimSpace";
import { juvenileScale } from "../simulation/lifeCycle";

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
    () => buildAsset(object.kind, object.seed, object.moss),
    [object.kind, object.seed, object.moss],
  );
  const rig = useMemo(
    () => createRig(object.kind, model),
    [object.kind, model],
  );
  const swimming = useMemo(
    () =>
      object.kind === "tiger-barb"
        ? new SwimRig(model, barbSwim, 1.3)
        : undefined,
    [object.kind, model],
  );
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
      facing: new THREE.Quaternion(),
      faced: false,
    }),
    [],
  );
  const ground = objectBase(object, environment);
  const swims = assets[object.kind].swims;
  const baseY = swims
    ? swimmingHeight(object.x, object.z, environment, swims.depth, -0.01)
    : ground;
  useFrame((_, frameDelta) => {
    const group = root.current;
    if (!group) return;
    const dt = Math.min(frameDelta, 0.05);
    if (!paused && !ghost && (!selected || swims)) clock.current += dt;
    const t = clock.current;
    // A watched animal stays selected while it moves, so only pausing stops it.
    const rigDelta = paused ? 0 : dt;
    group.position.set(object.x, baseY, object.z);
    group.rotation.set(0, object.rotation, 0);
    if (rig && !ghost && ecosystem) {
      const state = ecosystem.live.current!.engine.observeRenderedAnimal(
        object.id,
      );
      if (state) {
        group.position.set(
          state.position.x,
          state.position.y,
          state.position.z,
        );
        const live = ecosystem.live.current!;
        if (environment !== live.world.environment) {
          const node = live.engine.graph.node(state.nodeId);
          const supportId = node.plantId ?? node.supportId;
          const plant = supportId
            ? live.world.objects.find((part) => part.id === supportId)
            : undefined;
          const anchor = plant ?? state.position;
          // Navigation stays committed during a stroke; keep the preview pose
          // attached to the ground or to the base of its supporting plant.
          group.position.y +=
            groundHeight(anchor.x, anchor.z, environment) -
            groundHeight(anchor.x, anchor.z, live.world.environment);
        }
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
        // Ease into new headings so a change of edge reads as a turn, not a snap.
        if (pose.faced)
          pose.facing.slerp(pose.rotation, 1 - Math.exp(-12 * rigDelta));
        else pose.facing.copy(pose.rotation);
        pose.faced = true;
        group.quaternion.copy(pose.facing);
        group.position.y += state.motion.lift;
        group.rotateX(state.motion.tilt);
        rig.update(state, rigDelta);
        return;
      }
    }
    if (ghost || (selected && !swims)) return;
    // An animal without a reachable surface stays idle where it was placed.
    if (rig) {
      rig.update(undefined, rigDelta);
      return;
    }
    if (swims) {
      const fish = ecosystem?.live.current!.fish.get(object.id, environment);
      if (fish) {
        // Swim below the surface, but never sink into the ground.
        group.position.set(
          fish.x,
          (fish.y ?? swimmingHeight(fish.x, fish.z, environment, swims.depth)) +
            Math.sin(t * 1.3) * (fish.bob ?? SWIM_BOB),
          fish.z,
        );
        group.rotation.y = fish.heading;
      }
      // The tail beats side to side, faster for quicker fish.
      const tail = model.getObjectByName("tail");
      if (tail) tail.rotation.y = Math.sin(t * swims.speed * 40) * 0.35;
      swimming?.update(undefined, paused ? 0 : dt);
    } else if (categoryOf(assets[object.kind]) === "Plants") {
      group.rotation.z = Math.sin(t * 0.7 + object.seed) * 0.012;
    }
  });
  return (
    <group
      ref={root}
      userData={{
        plant: categoryOf(assets[object.kind]) === "Plants",
        objectId: object.id,
      }}
      position={[object.x, baseY, object.z]}
      rotation={[0, object.rotation, 0]}
      scale={object.scale * juvenileScale(object)}
      onClick={onSelect}
    >
      <primitive object={model} />
      {isAnimal(object.kind) && !ghost && (
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

function createRig(kind: AssetKind, model: THREE.Group) {
  if (lizardKinds.has(kind)) return new GeckoRig(model);
  if (kind === "snail") return new SnailRig(model);
  const arthropod = arthropodRigs.get(kind);
  if (arthropod) return new ArthropodRig(model, arthropod);
  if (kind === "turtle" || kind === "desert-tortoise")
    return new TurtleRig(model);
  if (isLandAnimal(kind)) return new FrogRig(model);
  return undefined;
}
