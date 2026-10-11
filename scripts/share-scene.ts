import * as THREE from "three";
import { buildAsset, disposeAsset } from "../src/assets";
import type { AssetKind } from "../src/model/schema";

// A corner of a planted tank around a blue dart frog. Models face -z,
// toward the camera, and +x is to the left of the picture.
const pieces: {
  kind: AssetKind;
  x: number;
  y?: number;
  z: number;
  rotation: number;
  scale: number;
}[] = [
  { kind: "blue-dart-frog", x: 0, z: 0, rotation: -1.1, scale: 1 },
  // Ground
  { kind: "sheet-moss", x: -0.02, z: 0.05, rotation: 0.8, scale: 0.9 },
  { kind: "fern-moss", x: 0.24, z: -0.08, rotation: 2.6, scale: 0.75 },
  { kind: "fern-moss", x: -0.38, z: 0.05, rotation: 1.4, scale: 1 },
  { kind: "leaf-litter", x: 0.28, z: 0.4, rotation: 2.1, scale: 0.45 },
  // A mossy rock with mushrooms at its foot and a bracket on its side
  { kind: "rock", x: -0.32, z: 0.38, rotation: 0.6, scale: 0.45 },
  {
    kind: "houseplant-mushrooms",
    x: -0.08,
    z: 0.22,
    rotation: 0.4,
    scale: 0.6,
  },
  { kind: "java-moss", x: -0.2, z: -0.2, rotation: 0.5, scale: 0.6 },
  { kind: "reishi", x: -0.18, y: 0.1, z: 0.2, rotation: 0.4, scale: 0.4 },
  { kind: "turkey-tail", x: -0.3, y: 0.17, z: 0.2, rotation: 2.2, scale: 0.35 },
  // Plants behind
  { kind: "monstera", x: -0.25, z: 1.0, rotation: 0.5, scale: 0.32 },
  { kind: "bromeliad", x: -0.62, z: 0.7, rotation: 0.3, scale: 0.42 },
  { kind: "nest-fern", x: 0.22, z: 0.75, rotation: 1.2, scale: 0.32 },
  { kind: "anthurium", x: 0.05, z: 1.15, rotation: 2.4, scale: 0.28 },
  // Low plants in front
  { kind: "cryptocoryne", x: -0.42, z: -0.22, rotation: 0.9, scale: 0.6 },
  { kind: "begonia", x: 0.24, z: -0.3, rotation: 0.2, scale: 0.36 },
];

/** The frog scene on a transparent canvas, pushed to the right of the card. */
export function renderScene(width: number, height: number): HTMLCanvasElement {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight("#fff3d5", 1.6));
  const key = new THREE.DirectionalLight("#ffffff", 3.5);
  key.position.set(-1, 5, -2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 6;
  Object.assign(key.shadow.camera, {
    left: -1.5,
    right: 1.5,
    top: 1.5,
    bottom: -1.5,
  });
  scene.add(key);
  // Only the shadows on this floor show, so the models sit on the card.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.ShadowMaterial({ opacity: 0.45 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const rim = new THREE.DirectionalLight("#b7d9cc", 2.5);
  rim.position.set(3, 2, 4);
  scene.add(rim);
  const models = pieces.map((piece) => {
    const model = buildAsset(piece.kind, 173);
    model.position.set(piece.x, piece.y ?? 0, piece.z);
    model.rotation.y = piece.rotation;
    model.scale.multiplyScalar(piece.scale);
    model.traverse((part) => (part.castShadow = true));
    scene.add(model);
    return model;
  });
  const camera = new THREE.PerspectiveCamera(28, width / height, 0.01, 30);
  // Aiming left of the frog puts it right of center, clear of the wordmark.
  camera.position.set(0.12, 0.38, -1.45);
  camera.lookAt(0.36, 0.2, 0);
  renderer.render(scene, camera);
  models.forEach(disposeAsset);
  return renderer.domElement;
}
