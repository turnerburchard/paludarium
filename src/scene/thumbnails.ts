import * as THREE from "three";
import type { AssetKind } from "../model/schema";
import { buildAsset, catalog, disposeAsset } from "../assets";

export type Thumbnails = Partial<Record<AssetKind, string>>;

let thumbnails: Promise<Thumbnails> | undefined;

/** Thumbnails are rendered once per page load and shared by every library mount.
 * Each render would otherwise create (and churn) a second WebGL context. */
export function loadThumbnails(): Promise<Thumbnails> {
  thumbnails ??= renderThumbnails();
  return thumbnails;
}

const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));

/** Uses the real asset builders, one asset per frame so the scene keeps drawing. */
async function renderThumbnails(): Promise<Thumbnails> {
  const output: Thumbnails = {};
  // Let the scene draw its first frames before competing for the GPU.
  await new Promise((resolve) => setTimeout(resolve, 500));
  let renderer: THREE.WebGLRenderer | undefined;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(160, 130);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(32, 160 / 130, 0.01, 30);
    scene.add(new THREE.AmbientLight("#fff3d5", 2));
    const key = new THREE.DirectionalLight("#ffffff", 3.5);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#b7d9cc", 2);
    fill.position.set(3, 2, -2);
    scene.add(fill);
    for (const asset of catalog) {
      await nextFrame();
      const model = buildAsset(asset.kind, 173),
        box = new THREE.Box3().setFromObject(model),
        center = box.getCenter(new THREE.Vector3()),
        size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z) * 1.8;
      camera.position
        .copy(center)
        .add(
          new THREE.Vector3(
            radius * 0.65,
            radius * 0.5,
            asset.category === "Animals" ? -radius : radius,
          ),
        );
      camera.lookAt(center);
      scene.add(model);
      renderer.render(scene, camera);
      output[asset.kind] = renderer.domElement.toDataURL();
      scene.remove(model);
      disposeAsset(model);
    }
  } catch {
    /* The tray remains usable as labeled buttons if WebGL is unavailable. */
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  return output;
}
