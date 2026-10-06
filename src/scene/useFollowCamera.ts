import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls } from "three-stdlib";
import type { EcosystemController } from "../simulation/useEcosystem";

/** Where the camera settles when watching starts: this far away, looking
 * down from high enough (angle from vertical) to see past most leaves. */
const CLOSE_UP = 2.4;
const CLOSE_UP_ANGLE = 0.85;
/** How close the viewer may zoom while watching. */
const WATCH_MIN_DISTANCE = 1;

/** Keeps the orbit target on a watched animal. It zooms in once when watching
 * starts; after that the viewer can orbit and zoom freely while it follows.
 * When watching stops, the camera eases back to where it was before. */
export function useFollowCamera(
  controls: RefObject<OrbitControls | null>,
  ecosystem: EcosystemController,
  animalId: string | null,
  resetCamera: number,
) {
  const zooming = useRef(false);
  const returning = useRef(false);
  /** The view before watching started, and the zoom limit to restore. */
  const home = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
    minDistance: number;
  } | null>(null);
  const vectors = useRef({
    animal: new THREE.Vector3(),
    step: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    view: new THREE.Spherical(),
  });
  useEffect(() => {
    const orbit = controls.current;
    zooming.current = animalId !== null;
    if (animalId && orbit) {
      returning.current = false;
      home.current ??= {
        position: orbit.object.position.clone(),
        target: orbit.target.clone(),
        minDistance: orbit.minDistance,
      };
      orbit.minDistance = WATCH_MIN_DISTANCE;
    }
    if (!animalId && home.current) returning.current = true;
  }, [animalId]);
  useEffect(() => {
    // Reset supersedes a return to the previous custom camera position.
    const orbit = controls.current;
    if (orbit && home.current) orbit.minDistance = home.current.minDistance;
    zooming.current = false;
    returning.current = false;
    home.current = null;
  }, [resetCamera]);
  useFrame((_, delta) => {
    const orbit = controls.current;
    if (orbit && returning.current && home.current) {
      const ease = 1 - Math.exp(-delta * 5);
      orbit.object.position.lerp(home.current.position, ease);
      orbit.target.lerp(home.current.target, ease);
      orbit.update();
      if (orbit.object.position.distanceTo(home.current.position) < 0.02) {
        orbit.minDistance = home.current.minDistance;
        returning.current = false;
        home.current = null;
      }
      return;
    }
    const animal = animalId
      ? ecosystem.live.current!.engine.observeAnimal(animalId)
      : undefined;
    if (!orbit || !animal) return;
    const { animal: position, step, offset, view } = vectors.current;
    const ease = 1 - Math.exp(-delta * 4);
    position.set(animal.position.x, animal.position.y + 0.1, animal.position.z);
    step.subVectors(position, orbit.target).multiplyScalar(ease);
    orbit.target.add(step);
    orbit.object.position.add(step);
    if (zooming.current) {
      // Keep the viewer's compass direction; ease distance and height.
      view.setFromVector3(
        offset.subVectors(orbit.object.position, orbit.target),
      );
      view.radius = THREE.MathUtils.lerp(view.radius, CLOSE_UP, ease);
      view.phi = THREE.MathUtils.lerp(view.phi, CLOSE_UP_ANGLE, ease);
      orbit.object.position
        .copy(orbit.target)
        .add(offset.setFromSpherical(view));
      if (
        Math.abs(view.radius - CLOSE_UP) < 0.05 &&
        Math.abs(view.phi - CLOSE_UP_ANGLE) < 0.02
      )
        zooming.current = false;
    }
    orbit.update();
  });
}
