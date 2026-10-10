import type { EcosystemController } from "../simulation/useEcosystem";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  assetRadius,
  assets,
  buildAsset,
  categoryOf,
  disposeAsset,
  isAnimal,
  isLandAnimal,
} from "../assets";
import type { AssetKind, Environment, HabitatObject } from "../model/schema";
import { swimmingHeight } from "../model/water";
import { groundHeight, groundNormal } from "../model/terrain";
import { objectBase } from "../model/stacking";
import { FrogRig } from "./frogRig";
import { GeckoRig } from "./geckoRig";
import { lizardKinds } from "../assets/animals/lizards";
import { SnailRig } from "./snailRig";
import { ArthropodRig } from "./arthropodRig";
import { arthropodRigs } from "../assets/animals/arthropods";
import { TurtleRig } from "./turtleRig";
import { SwimRig } from "./swimRig";
import { FishCurl } from "./fishCurl";
import { barbSwim } from "../assets/animals/barb";
import { juvenileScale } from "../simulation/lifeCycle";
import { FoliageMotion, type FoliageVisitor } from "./foliageMotion";

interface Props {
  object: HabitatObject;
  environment: Environment;
  paused: boolean;
  selected?: boolean;
  ghost?: boolean;
  invalid?: boolean;
  ecosystem?: EcosystemController;
  foliageVisitors?: RefObject<FoliageVisitor[]>;
  foliagePlants?: RefObject<Map<string, THREE.Group>>;
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
  foliageVisitors,
  foliagePlants,
}: Props) {
  const root = useRef<THREE.Group>(null),
    foliage = useRef<THREE.Group>(null),
    clock = useRef(0);
  const model = useMemo(
    () => buildAsset(object.kind, object.seed, object.moss),
    [object.kind, object.seed, object.moss],
  );
  const rig = useMemo(
    () => createRig(object.kind, model),
    [object.kind, model],
  );
  const plant = categoryOf(assets[object.kind]) === "Plants";
  const foliageMotion = useMemo(
    () => (plant ? new FoliageMotion(object.seed, object.id) : undefined),
    [plant, object.id, object.seed],
  );
  const plantHeight = useMemo(
    () => (plant ? new THREE.Box3().setFromObject(model).max.y : 0),
    [plant, model],
  );
  const swimming = useMemo(
    () =>
      object.kind === "tiger-barb"
        ? new SwimRig(model, barbSwim, 1.3)
        : undefined,
    [object.kind, model],
  );
  const curl = useMemo(
    () => (assets[object.kind].swims ? new FishCurl(model) : undefined),
    [object.kind, model],
  );
  useEffect(() => () => disposeAsset(model), [model]);
  useEffect(() => {
    const group = foliage.current;
    if (!plant || ghost || !group || !foliagePlants) return;
    const plants = foliagePlants.current;
    plants.set(object.id, group);
    return () => {
      plants.delete(object.id);
    };
  }, [plant, ghost, object.id, foliagePlants]);
  useEffect(() => {
    clock.current = 0;
  }, [object.x, object.z]);
  useEffect(() => {
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          // Some animals, such as micro crabs, are see-through already.
          m.userData.opacity ??= m.opacity;
          m.transparent = ghost || m.userData.opacity < 1;
          m.opacity = m.userData.opacity * (ghost ? 0.55 : 1);
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
    ? swimmingHeight(object.x, object.z, environment, swims.depth)
    : ground;
  const framePriority = plant ? -0.5 : 0;
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
    if (foliageMotion && foliage.current && !ghost) {
      const stopped = paused || selected || document.hidden;
      const tilt = foliageMotion.update(
        stopped ? 0 : dt,
        group.position,
        assetRadius(object.kind) * object.scale,
        plantHeight * object.scale,
        foliageVisitors?.current ?? [],
      );
      const cos = Math.cos(object.rotation),
        sin = Math.sin(object.rotation);
      // Convert the world-space push into the plant's rotated local axes.
      foliage.current.rotation.set(
        sin * tilt.x + cos * tilt.z,
        0,
        -(cos * tilt.x - sin * tilt.z),
      );
      return;
    }
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
        // On the ground, follow the terrain under the animal rather than the
        // straight line between nodes, and lean with its slope.
        const slope = state.grounded
          ? groundNormal(state.position.x, state.position.z, environment)
          : undefined;
        if (slope)
          group.position.y = groundHeight(
            state.position.x,
            state.position.z,
            environment,
          );
        else if (environment !== live.world.environment) {
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
        const normal = slope ?? state.normal;
        pose.normal.set(normal.x, normal.y, normal.z).normalize();
        pose.forward.set(
          state.direction.x,
          state.direction.y,
          state.direction.z,
        );
        if (!state.grounded && !state.motion.hop) {
          const plantId = live.engine.graph.node(state.nodeId).plantId;
          const support = plantId && foliagePlants?.current.get(plantId);
          const anchor = support && support.parent;
          if (support && anchor) {
            // Apply only the visual lean, retaining the navigation's fixed pose.
            support.updateWorldMatrix(true, false);
            pose.matrix.copy(anchor.matrixWorld).invert();
            pose.matrix.premultiply(support.matrixWorld);
            group.position.applyMatrix4(pose.matrix);
            pose.normal.transformDirection(pose.matrix);
            pose.forward.transformDirection(pose.matrix);
          }
        }
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
      const live = ecosystem?.live.current;
      const fish = live?.engine.observeRenderedAnimal(object.id);
      if (live && fish) {
        const { position, direction } = fish;
        // A terrain preview can raise the ground before the habitat is
        // rebuilt. Lift the fish with it rather than sinking it in the sand.
        const raised = Math.max(
          0,
          groundHeight(position.x, position.z, environment) -
            groundHeight(position.x, position.z, live.world.environment),
        );
        group.position.set(
          position.x,
          position.y + fish.motion.lift + raised,
          position.z,
        );
        group.rotation.set(
          Math.asin(direction.y),
          Math.atan2(-direction.x, -direction.z),
          0,
          "YXZ",
        );
      }
      // The tail beats side to side, faster for quicker fish.
      const tail = model.getObjectByName("tail");
      if (tail) tail.rotation.y = Math.sin(t * swims.speed * 40) * 0.35;
      swimming?.update(undefined, paused ? 0 : dt);
      curl?.update(fish?.motion.bend ?? 0, paused ? 0 : dt);
    }
  }, framePriority);
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
      <group ref={foliage}>
        <primitive object={model} />
      </group>
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
              assetRadius(object.kind) + 0.04,
              assetRadius(object.kind) + 0.065,
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
