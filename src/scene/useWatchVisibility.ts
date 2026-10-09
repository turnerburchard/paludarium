import { useEffect, useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EcosystemController } from "../simulation/useEcosystem";
import { WatchVisibility } from "./watchVisibility";

export function useWatchVisibility(
  inhabitants: RefObject<THREE.Group | null>,
  ecosystem: EcosystemController,
  animalId: string | null,
) {
  const visibility = useMemo(() => new WatchVisibility(), []);
  const vectors = useMemo(
    () => ({
      focus: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      foliage: [] as THREE.Mesh[],
    }),
    [],
  );
  useEffect(() => () => visibility.restore(), [visibility, animalId]);
  useFrame(({ camera, invalidate }, dt) => {
    if (!animalId || !inhabitants.current) return;
    const animal = ecosystem.live.current!.engine.observeAnimal(animalId);
    if (!animal) return;
    const { focus, normal, right, up, foliage } = vectors;
    focus.set(
      animal.position.x,
      animal.position.y + animal.motion.lift,
      animal.position.z,
    );
    focus.addScaledVector(
      normal.set(animal.normal.x, animal.normal.y, animal.normal.z),
      0.1,
    );
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    foliage.length = 0;
    for (const object of inhabitants.current.children) {
      if (!object.userData.plant) continue;
      object.traverse((part) => {
        if (part instanceof THREE.Mesh) foliage.push(part);
      });
    }
    visibility.update(camera.position, focus, right, up, foliage, dt);
    // Leaves fade over several frames, even while life is paused.
    invalidate();
  });
}
