import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls } from "three-stdlib";
import type { Environment } from "../model/schema";

/** How far past the glass panning may carry the orbit target. */
const PAN_MARGIN = 2;

/** Pulls the orbit target back near the tank so it can't be panned out of
 * reach. The camera moves with it, keeping the view's angle and distance. */
export function keepTankInReach(
  orbit: OrbitControls,
  environment: Environment,
) {
  const { target } = orbit,
    reachX = environment.width / 2 + PAN_MARGIN,
    reachZ = environment.depth / 2 + PAN_MARGIN;
  const shiftX = THREE.MathUtils.clamp(target.x, -reachX, reachX) - target.x,
    shiftZ = THREE.MathUtils.clamp(target.z, -reachZ, reachZ) - target.z;
  target.x += shiftX;
  target.z += shiftZ;
  orbit.object.position.x += shiftX;
  orbit.object.position.z += shiftZ;
}

/** Keyboard movement shifts camera and orbit target together, preserving the user's view. */
export function useCameraNavigation(
  controls: RefObject<OrbitControls | null>,
  environment: Environment,
  enabled: boolean,
  onNavigate: () => void,
) {
  const keys = useRef(new Set<string>());
  const invalidate = useThree((state) => state.invalidate);
  const vectors = useRef({
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    movement: new THREE.Vector3(),
  });
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        !enabled ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest("input,textarea,select,[contenteditable=true]")
      )
        return;
      if (
        ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight"].includes(
          event.code,
        )
      ) {
        event.preventDefault();
        keys.current.add(event.code);
        // Paused, nothing else draws the frame that starts moving.
        invalidate();
      }
    }
    const keyup = (event: KeyboardEvent) => keys.current.delete(event.code);
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    document.addEventListener("focusin", clear);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      document.removeEventListener("focusin", clear);
      clear();
    };
  }, [enabled, invalidate]);
  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!orbit || !enabled || keys.current.size === 0) return;
    const { forward, right, movement } = vectors.current,
      held = keys.current;
    orbit.object.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();
    movement.set(0, 0, 0);
    if (held.has("KeyW")) movement.add(forward);
    if (held.has("KeyS")) movement.sub(forward);
    if (held.has("KeyD")) movement.add(right);
    if (held.has("KeyA")) movement.sub(right);
    if (movement.lengthSq() === 0) return;
    onNavigate();
    const speed = held.has("ShiftLeft") || held.has("ShiftRight") ? 5 : 2.4;
    movement.normalize().multiplyScalar(speed * Math.min(delta, 0.05));
    orbit.target.add(movement);
    orbit.object.position.add(movement);
    keepTankInReach(orbit, environment);
    orbit.update();
  });
}
