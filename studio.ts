import * as THREE from "three";
import { assets, buildAsset } from "./src/assets";
import type { AssetKind } from "./src/model/schema";
import { FishCurl } from "./src/scene/fishCurl";

const kinds = (new URLSearchParams(location.search).get("kinds")?.split(",") ?? (Object.keys(assets) as AssetKind[]).filter((k) => assets[k].swims)) as AssetKind[];
const bends = [0, 0.5, 1, -1];
const cell = Number(new URLSearchParams(location.search).get("cell") ?? 220);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(cell * bends.length, cell * kinds.length);
renderer.setScissorTest(true);
for (const [row, kind] of kinds.entries())
  for (const [col, bend] of bends.entries()) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1d2b2a");
    scene.add(new THREE.AmbientLight("#fff3d5", 2));
    const key = new THREE.DirectionalLight("#ffffff", 3.5);
    key.position.set(1, 3, 2);
    scene.add(key);
    const model = buildAsset(kind, 1);
    const curl = new FishCurl(model);
    curl.update(bend, 10);
    scene.add(model);
    // Collision box outline: straight or curled.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 0.3) * 0.75;
    const camera = new THREE.OrthographicCamera(-span, span, span, -span, 0.01, 10);
    camera.position.set(0, 3, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    const y = (kinds.length - 1 - row) * cell;
    renderer.setViewport(col * cell, y, cell, cell);
    renderer.setScissor(col * cell, y, cell, cell);
    renderer.render(scene, camera);
  }
(window as any).done = kinds;
