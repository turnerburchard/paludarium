import { useEffect, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";

/** Camera gestures bypass scene tools, including the terrain brush. */
export function useBuildCamera(controls: RefObject<OrbitControls | null>) {
  const { gl, events } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const surface =
      events.connected instanceof HTMLElement ? events.connected : canvas;
    let active = false;
    let rotate = true;
    let suppressClick = false;
    function down(event: PointerEvent) {
      if (active) return;
      suppressClick = false;
      if (event.pointerType === "touch") return;
      suppressClick = event.button === 1 || event.button === 2 || event.altKey;
      if (!suppressClick || !controls.current) return;
      active = true;
      rotate = controls.current.enableRotate;
      controls.current.enableRotate = true;
      events.enabled = false;
    }
    function release() {
      if (!active) return;
      active = false;
      if (controls.current) controls.current.enableRotate = rotate;
      events.enabled = true;
    }
    function click(event: MouseEvent) {
      if (!suppressClick) return;
      event.stopPropagation();
      event.preventDefault();
    }
    surface.addEventListener("pointerdown", down, true);
    surface.addEventListener("click", click, true);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      release();
      surface.removeEventListener("pointerdown", down, true);
      surface.removeEventListener("click", click, true);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, [controls, events, gl]);
}
