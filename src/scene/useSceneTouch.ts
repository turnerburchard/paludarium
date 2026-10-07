import { useEffect, useRef, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";

type TouchPoint = { clientX: number; clientY: number };

/** Touch snapshots stay complete even when iOS drops a pointer release. */
export function useSceneTouch(
  controls: RefObject<OrbitControls | null>,
  enabled: boolean,
  onTap: (point: TouchPoint) => void,
) {
  const { gl, events } = useThree();
  const commit = useRef(onTap);
  commit.current = onTap;
  const suppressClick = useRef(false);
  useEffect(() => {
    const canvas = gl.domElement;
    const surface =
      events.connected instanceof HTMLElement ? events.connected : canvas;
    let active = false;
    let tap: { id: number; x: number; y: number } | null = null;
    let span = 0;
    let zoomEnabled = true;
    function restoreZoom() {
      if (controls.current) controls.current.enableZoom = zoomEnabled;
    }
    function distance(touches: TouchList) {
      const [first, second] = touches;
      return Math.hypot(
        first.clientX - second.clientX,
        first.clientY - second.clientY,
      );
    }
    function start(event: TouchEvent) {
      // One finger marks a fresh gesture, even if the previous end was lost.
      if (event.touches.length === 1) {
        if (active) restoreZoom();
        zoomEnabled = controls.current?.enableZoom ?? true;
      }
      active = true;
      suppressClick.current = enabled;
      const first = event.touches[0];
      tap =
        enabled && event.touches.length === 1
          ? { id: first.identifier, x: first.clientX, y: first.clientY }
          : null;
      span = event.touches.length === 2 ? distance(event.touches) : 0;
      if (event.touches.length > 1 && controls.current)
        controls.current.enableZoom = false;
    }
    function move(event: TouchEvent) {
      if (!active) return;
      const first = event.touches[0];
      if (
        tap &&
        (event.touches.length !== 1 ||
          first.identifier !== tap.id ||
          Math.hypot(first.clientX - tap.x, first.clientY - tap.y) > 12)
      )
        tap = null;
      const orbit = controls.current;
      if (!orbit || event.touches.length !== 2) return;
      const nextSpan = distance(event.touches);
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
    function end(event: TouchEvent) {
      if (!active) return;
      const finished = tap;
      tap = null;
      span = 0;
      if (event.touches.length !== 0) return;
      active = false;
      restoreZoom();
      if (!finished || event.changedTouches.length !== 1) return;
      const point = event.changedTouches[0];
      const box = canvas.getBoundingClientRect();
      if (
        point.identifier === finished.id &&
        Math.hypot(point.clientX - finished.x, point.clientY - finished.y) <=
          12 &&
        point.clientX >= box.left &&
        point.clientX <= box.right &&
        point.clientY >= box.top &&
        point.clientY <= box.bottom
      )
        commit.current(point);
    }
    function cancel() {
      if (active) restoreZoom();
      active = false;
      tap = null;
      span = 0;
    }
    function down(event: PointerEvent) {
      if (event.pointerType !== "touch") suppressClick.current = false;
    }
    function click(event: MouseEvent) {
      // Safari can dispatch a compatibility click after the touch committed.
      if (!suppressClick.current) return;
      event.stopPropagation();
      event.preventDefault();
    }
    surface.addEventListener("pointerdown", down, true);
    surface.addEventListener("touchstart", start, {
      capture: true,
      passive: true,
    });
    surface.addEventListener("click", click, true);
    document.addEventListener("touchmove", move, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchend", end, true);
    document.addEventListener("touchcancel", cancel, true);
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      surface.removeEventListener("pointerdown", down, true);
      surface.removeEventListener("touchstart", start, true);
      surface.removeEventListener("click", click, true);
      document.removeEventListener("touchmove", move, true);
      document.removeEventListener("touchend", end, true);
      document.removeEventListener("touchcancel", cancel, true);
      window.removeEventListener("blur", cancel);
    };
  }, [enabled, gl, events, controls]);
}
