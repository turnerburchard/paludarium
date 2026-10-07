import { useEffect, useRef, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";

/** Track the whole touch gesture, including fingers outside raycastable objects. */
export function useSceneTouch(
  controls: RefObject<OrbitControls | null>,
  enabled: boolean,
  onTap: (event: PointerEvent) => void,
) {
  const { gl, events } = useThree();
  const commit = useRef(onTap);
  commit.current = onTap;
  const suppressClick = useRef(false);
  useEffect(() => {
    const canvas = gl.domElement;
    // Fiber and OrbitControls receive events on the surrounding container.
    // Pointer capture can route a canvas tap's release to that container.
    const surface =
      events.connected instanceof HTMLElement ? events.connected : canvas;
    const pointers = new Map<number, { x: number; y: number }>();
    let tap: { id: number; x: number; y: number } | null = null;
    let span = 0;
    let zoomEnabled = true;
    function distance() {
      const [first, second] = pointers.values();
      return Math.hypot(first.x - second.x, first.y - second.y);
    }
    function zoom(event: TouchEvent) {
      const orbit = controls.current;
      if (!orbit || pointers.size !== 2 || event.touches.length !== 2) return;
      // Pointer moves arrive one finger at a time, potentially across frames.
      // The touch event supplies both positions from the same input sample.
      const [first, second] = event.touches;
      const nextSpan = Math.hypot(
        first.clientX - second.clientX,
        first.clientY - second.clientY,
      );
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
        // OrbitControls handles panning; complete touch samples handle zoom.
        controls.current.enableZoom = false;
      }
    }
    function move(event: PointerEvent) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (
        tap?.id === event.pointerId &&
        Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 12
      )
        tap = null;
    }
    function up(event: PointerEvent) {
      if (!pointers.delete(event.pointerId)) return;
      if (pointers.size === 0 && controls.current)
        controls.current.enableZoom = zoomEnabled;
      const finished = tap;
      tap = null;
      if (
        finished?.id === event.pointerId &&
        pointers.size === 0 &&
        surface.contains(
          document.elementFromPoint(event.clientX, event.clientY),
        ) &&
        Math.hypot(event.clientX - finished.x, event.clientY - finished.y) <= 12
      )
        commit.current(event);
    }
    function cancel() {
      tap = null;
      pointers.clear();
      if (controls.current) controls.current.enableZoom = zoomEnabled;
    }
    function click(event: MouseEvent) {
      // A touch commits on release; Safari can still dispatch a subsequent click.
      if (!suppressClick.current) return;
      event.stopPropagation();
      event.preventDefault();
    }
    surface.addEventListener("pointerdown", down, true);
    surface.addEventListener("click", click, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("touchmove", zoom, {
      capture: true,
      passive: true,
    });
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      surface.removeEventListener("pointerdown", down, true);
      surface.removeEventListener("click", click, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("touchmove", zoom, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, [enabled, gl, events, controls]);
}
