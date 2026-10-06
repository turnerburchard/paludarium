import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls } from "three-stdlib";
import type { EcosystemController } from "../simulation/useEcosystem";

/** Camera distance when watching starts. */
const CLOSE_UP = 2.2;

/** Keeps the orbit target on a watched animal. It zooms in once when watching
 * starts; after that the viewer can orbit and zoom freely while it follows. */
export function useFollowCamera(
  controls: RefObject<OrbitControls | null>,
  ecosystem: EcosystemController,
  animalId: string | null,
) {
  const zooming = useRef(false);
  const vectors = useRef({
    animal: new THREE.Vector3(),
    step: new THREE.Vector3(),
  });
  useEffect(() => {
    zooming.current = animalId !== null;
  }, [animalId]);
  useFrame((_, delta) => {
    const orbit = controls.current;
    const animal = animalId
      ? ecosystem.live.current!.engine.getAnimal(animalId)
      : undefined;
    if (!orbit || !animal) return;
    const { animal: position, step } = vectors.current;
    const ease = 1 - Math.exp(-delta * 4);
    position.set(animal.position.x, animal.position.y + 0.1, animal.position.z);
    step.subVectors(position, orbit.target).multiplyScalar(ease);
    orbit.target.add(step);
    orbit.object.position.add(step);
    if (zooming.current) {
      step.subVectors(orbit.object.position, orbit.target);
      const distance = THREE.MathUtils.lerp(step.length(), CLOSE_UP, ease);
      orbit.object.position
        .copy(orbit.target)
        .addScaledVector(step.normalize(), distance);
      if (Math.abs(distance - CLOSE_UP) < 0.05) zooming.current = false;
    }
    orbit.update();
  });
}
