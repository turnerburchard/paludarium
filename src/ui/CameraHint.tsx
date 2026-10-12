/** A first visit's one-line guide to moving the camera. It fades once the
 * camera has been moved, since by then it has done its job. */
export function CameraHint({
  fading,
  onFaded,
}: {
  fading: boolean;
  onFaded: () => void;
}) {
  const touch = matchMedia("(pointer: coarse)").matches;
  return (
    <p
      className={fading ? "camera-hint fading" : "camera-hint"}
      onTransitionEnd={onFaded}
    >
      {touch
        ? "Drag to look · Pinch to zoom · Two fingers to move"
        : "Drag or Alt/Option-drag to look · Scroll to zoom · Right-drag to move"}
    </p>
  );
}
