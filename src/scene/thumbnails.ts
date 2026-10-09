import * as THREE from "three";
import { emptyWorld } from "../model/schema";
import { buildAsset, catalog, disposeAsset, isAnimal } from "../assets";
import { prebuiltObjects, prebuilts } from "../model/prebuilts";
import { objectBase } from "../model/stacking";

/** Pictures by asset kind, or by `prebuilt:` and a prebuilt's id. */
export type Thumbnails = Partial<Record<string, string>>;

const thumbnails: Thumbnails = {};
let pending: Promise<Thumbnails> = Promise.resolve({});

/** Serialize batches so scrolling and tab changes never compete for WebGL contexts. */
export function loadThumbnails(
  keys: string[],
  signal: AbortSignal,
): Promise<Thumbnails> {
  pending = pending.then(async () => {
    const missing = keys.filter((key) => !thumbnails[key]);
    if (missing.length && !signal.aborted)
      Object.assign(thumbnails, await renderThumbnails(missing, signal));
    return Object.fromEntries(keys.map((key) => [key, thumbnails[key]]));
  });
  return pending;
}

const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));

/** Uses the real asset builders, a few assets per frame so the scene keeps drawing. */
async function renderThumbnails(
  keys: string[],
  signal: AbortSignal,
): Promise<Thumbnails> {
  const output: Thumbnails = {};
  // Let the scene draw its first frames before competing for the GPU.
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (signal.aborted) return output;
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
    for (const [i, key] of keys.entries()) {
      // A few per frame: each wait also renders the full scene, which is
      // slow on software rendering.
      if (i % 2 === 0) await nextFrame();
      if (signal.aborted) break;
      const { model, back } = thumbnailModel(key),
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
            back ? -radius : radius,
          ),
        );
      camera.lookAt(center);
      scene.add(model);
      renderer.render(scene, camera);
      output[key] = renderer.domElement.toDataURL();
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

/** An asset's model, or a prebuilt's pieces stacked as they would be in a
 * tank. Animals are pictured from behind. */
function thumbnailModel(key: string) {
  const asset = catalog.find((asset) => asset.kind === key);
  if (asset)
    return { model: buildAsset(asset.kind, 173), back: isAnimal(asset.kind) };
  const prebuilt = prebuilts.find((p) => `prebuilt:${p.id}` === key)!;
  const env = emptyWorld().environment;
  const model = new THREE.Group();
  for (const piece of prebuiltObjects(prebuilt, 0, 0, 0, env, () => 0.3)) {
    const part = buildAsset(piece.kind, 173);
    part.position.set(piece.x, objectBase(piece, env), piece.z);
    part.rotation.y = piece.rotation;
    part.scale.multiplyScalar(piece.scale);
    model.add(part);
  }
  return { model, back: false };
}
