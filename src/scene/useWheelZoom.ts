import { useEffect, useRef, type RefObject } from "react";
import type { OrbitControls } from "three-stdlib";

/** How much each pixel scrolled zooms. A mouse wheel notch, about 100
 * pixels, zooms 5%, the same as OrbitControls' fixed step. */
const ZOOM_PER_PIXEL = 0.0005;
/** Trackpad pinches arrive as ctrl+wheel, where 100 pixels means a factor of e. */
const PINCH_PER_PIXEL = 0.01;
/** A single event zooms at most this much, in case a mouse wheel is turned with ctrl held. */
const MAX_ZOOM = 0.2;

/** OrbitControls zooms one fixed step per wheel event, so trackpads and
 * smooth-scrolling mice, which send many small events, zoomed far too fast.
 * This zooms by how far the wheel actually scrolled instead. */
export function useWheelZoom(
  controls: RefObject<OrbitControls | null>,
  onZoom: () => void,
) {
  const notify = useRef(onZoom);
  notify.current = onZoom;
  useEffect(() => {
    function wheel(event: WheelEvent) {
      const orbit = controls.current;
      if (
        !orbit?.enabled ||
        !orbit.enableZoom ||
        !(event.target instanceof Node) ||
        !orbit.domElement?.contains(event.target)
      )
        return;
      // Runs before OrbitControls' own handler, which would add its fixed step.
      event.stopPropagation();
      event.preventDefault();
      const pixels =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * 33
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaY * innerHeight
            : event.deltaY;
      const rate = event.ctrlKey ? PINCH_PER_PIXEL : ZOOM_PER_PIXEL;
      const scale = Math.exp(-Math.min(Math.abs(pixels) * rate, MAX_ZOOM));
      if (pixels < 0) orbit.dollyIn(scale);
      else if (pixels > 0) orbit.dollyOut(scale);
      notify.current();
    }
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", wheel, { capture: true });
  }, [controls]);
}
