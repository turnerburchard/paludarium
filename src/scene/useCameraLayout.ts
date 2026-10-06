import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls } from "three-stdlib";

/** Modes share one canvas and camera. Make room for desktop tools by easing
 * the projection, keeping the viewer's orbit and zoom intact. */
export function useCameraLayout(
  controls: RefObject<OrbitControls | null>,
  reset: number,
  view: boolean,
) {
  const { camera, size } = useThree();
  const framed = useRef({ reset: -1, aspect: 0 });
  const offset = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const aspect = size.width / size.height;
    const orbit = controls.current;
    if (!orbit || !aspect) return;
    const last = framed.current;
    if (last.reset === reset && Math.abs(aspect / last.aspect - 1) < 0.15)
      return;
    framed.current = { reset, aspect };
    const fit = Math.max(1, 1.18 / aspect);
    orbit.object.position.set(8 * fit, 6.6 * fit, 9.8 * fit);
    orbit.target.set(0, 0.8, 0);
    orbit.update();
  }, [reset, size.width, size.height]);
  useFrame((_, dt) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const desktopBuild = !view && size.width > 760;
    const x = desktopBuild ? -150 : 0;
    const y = desktopBuild ? -39 : 0;
    const ease = 1 - Math.exp(-Math.min(dt, 0.1) * 12);
    offset.current.x = THREE.MathUtils.lerp(offset.current.x, x, ease);
    offset.current.y = THREE.MathUtils.lerp(offset.current.y, y, ease);
    if (Math.abs(offset.current.x - x) < 0.05) offset.current.x = x;
    if (Math.abs(offset.current.y - y) < 0.05) offset.current.y = y;
    const projection = camera.view;
    if (
      projection?.enabled &&
      projection.offsetX === offset.current.x &&
      projection.offsetY === offset.current.y &&
      projection.fullWidth === size.width &&
      projection.fullHeight === size.height
    )
      return;
    camera.setViewOffset(
      size.width,
      size.height,
      offset.current.x,
      offset.current.y,
      size.width,
      size.height,
    );
  });
}
