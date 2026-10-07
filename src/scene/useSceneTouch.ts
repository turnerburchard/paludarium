import { useEffect, useRef, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";

/** Track the whole touch gesture, including fingers outside raycastable objects. */
export function useSceneTouch(
  controls: RefObject<OrbitControls | null>,
  enabled: boolean,
  onTap: (event: PointerEvent) => void,
) {
  const { gl } = useThree();
  const commit = useRef(onTap);
  commit.current = onTap;
  const suppressClick = useRef(false);
  useEffect(() => {
    const canvas = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let tap: { id: number; x: number; y: number } | null = null;
    let span = 0;
    let zoomFrame = 0;
    let zoomEnabled = true;
    function distance() {
      const [first, second] = pointers.values();
      return Math.hypot(first.x - second.x, first.y - second.y);
    }
    function zoom() {
      zoomFrame = 0;
      const orbit = controls.current;
      if (!orbit || pointers.size !== 2) return;
      const nextSpan = distance();
      if (zoomEnabled && span > 0 && nextSpan > 0) {
        const offset = orbit.object.position.clone().sub(orbit.target);
        const nextDistance = Math.max(
          orbit.minDistance,
          Math.min(orbit.maxDistance, (offset.length() * span) / nextSpan),
        );
        orbit.object.position
          .copy(orbit.target)
          .add(offset.setLength(nextDistance));
        orbit.update();
      }
      span = nextSpan;
    }
    function down(event: PointerEvent) {
      suppressClick.current = enabled && event.pointerType === "touch";
      if (event.pointerType !== "touch") return;
      if (pointers.size === 0)
        zoomEnabled = controls.current?.enableZoom ?? true;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      tap =
        enabled && pointers.size === 1
          ? { id: event.pointerId, x: event.clientX, y: event.clientY }
          : null;
      if (pointers.size === 2 && controls.current) {
        span = distance();
        // OrbitControls pans each pointer separately. Zoom after both fingers
        // update, so a parallel drag doesn't zoom against the distance limits.
        controls.current.enableZoom = false;
      }
    }
    function move(event: PointerEvent) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2 && !zoomFrame)
        zoomFrame = requestAnimationFrame(zoom);
      if (
        tap?.id === event.pointerId &&
        Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 12
      )
        tap = null;
    }
    function up(event: PointerEvent) {
      if (zoomFrame) {
        cancelAnimationFrame(zoomFrame);
        zoom();
      }
      if (!pointers.delete(event.pointerId)) return;
      if (pointers.size === 0 && controls.current)
        controls.current.enableZoom = zoomEnabled;
      const finished = tap;
      tap = null;
      if (
        finished?.id === event.pointerId &&
        pointers.size === 0 &&
        event.target === canvas &&
        Math.hypot(event.clientX - finished.x, event.clientY - finished.y) <= 12
      )
        commit.current(event);
    }
    function cancel() {
      tap = null;
      pointers.clear();
      cancelAnimationFrame(zoomFrame);
      zoomFrame = 0;
      if (controls.current) controls.current.enableZoom = zoomEnabled;
    }
    function click(event: MouseEvent) {
      // A touch commits on release; Safari can still dispatch a subsequent click.
      if (!suppressClick.current) return;
      event.stopPropagation();
      event.preventDefault();
    }
    canvas.addEventListener("pointerdown", down, true);
    canvas.addEventListener("click", click, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      canvas.removeEventListener("pointerdown", down, true);
      canvas.removeEventListener("click", click, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, [enabled, gl, controls]);
}
