import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { finishWork } from "../work";

/** Bake static model parts into one draw per kind of surface. Each part's
 * color moves into its vertex colors, so parts that differ only in color
 * share a draw. Animals keep their separate parts for animation. Nothing is
 * shared between instances, so disposal and translucent placement previews
 * remain safe. */
export function batchStaticAsset(root: THREE.Group): THREE.Group {
  return finishWork(batchStaticAssetSteps(root));
}

export function* batchStaticAssetSteps(
  root: THREE.Group,
): Generator<void, THREE.Group> {
  // A plant can keep a rigid trunk or pole while its foliage moves. Bake
  // each separately, retaining the shared model coordinates and calibration.
  const foliage = root.children.find((part) => part.name === "foliage");
  if (foliage instanceof THREE.Group) {
    root.updateMatrixWorld(true);
    foliage.removeFromParent();
    foliage.applyMatrix4(root.matrixWorld);
    let leaves = foliage;
    let result: THREE.Group | undefined;
    try {
      leaves = yield* batchStaticAssetSteps(foliage);
      leaves.name = "foliage";
      result = yield* batchStaticAssetSteps(root);
      result.add(leaves);
      return result;
    } finally {
      // The caller still owns detached foliage if either batch is cancelled.
      if (!result) root.add(leaves);
    }
  }
  const batches = new Map<
    string,
    { material: THREE.MeshStandardMaterial; geometries: THREE.BufferGeometry[] }
  >();
  const originalGeometries = new Set<THREE.BufferGeometry>();
  const originalMaterials = new Set<THREE.Material>();
  const result = new THREE.Group();
  let completed = false;
  try {
    root.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    root.traverse((part) => {
      if (part instanceof THREE.Mesh) meshes.push(part);
    });
    for (const part of meshes) {
      yield;
      const mat = part.material as THREE.MeshStandardMaterial;
      const key = `${mat.roughness}:${mat.metalness}:${mat.side}:${mat.flatShading}`;
      const geometry = part.geometry.index
        ? part.geometry.toNonIndexed()
        : part.geometry.clone();
      geometry.applyMatrix4(part.matrixWorld);
      // These procedural assets have no textures. UVs differ between primitives.
      geometry.deleteAttribute("uv");
      let batch = batches.get(key);
      if (!batch) {
        batch = { material: mat, geometries: [] };
        batches.set(key, batch);
      }
      batch.geometries.push(geometry);
      yield* bakeColorSteps(geometry, mat);
      originalGeometries.add(part.geometry);
      originalMaterials.add(mat);
    }
    for (const { material, geometries } of batches.values()) {
      yield;
      const merged = mergeGeometries(geometries);
      if (!merged)
        throw new Error("Could not batch procedural asset geometry.");
      // The vertex colors now carry each part's color.
      material.color.set(0xffffff);
      material.vertexColors = true;
      const part = new THREE.Mesh(merged, material);
      part.castShadow = part.receiveShadow = true;
      result.add(part);
    }
    originalGeometries.forEach((geometry) => geometry.dispose());
    const retained = new Set(
      [...batches.values()].map((batch) => batch.material),
    );
    originalMaterials.forEach((material) => {
      if (!retained.has(material as THREE.MeshStandardMaterial))
        material.dispose();
    });
    completed = true;
    return result;
  } finally {
    for (const { geometries } of batches.values())
      geometries.forEach((geometry) => geometry.dispose());
    if (!completed)
      for (const part of result.children)
        if (part instanceof THREE.Mesh) part.geometry.dispose();
  }
}

/** The shader multiplies the material color by the vertex colors, so baking
 * the one into the other draws the same. Vertex colors the material ignores
 * are replaced. */
function* bakeColorSteps(
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
) {
  const tint = material.vertexColors
    ? geometry.getAttribute("color")
    : undefined;
  const { count } = geometry.getAttribute("position");
  const colors = new Float32Array(count * 3);
  const { r, g, b } = material.color;
  for (let i = 0; i < count; i++) {
    if (i % 384 === 0) yield;
    colors[i * 3] = r * (tint?.getX(i) ?? 1);
    colors[i * 3 + 1] = g * (tint?.getY(i) ?? 1);
    colors[i * 3 + 2] = b * (tint?.getZ(i) ?? 1);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}
