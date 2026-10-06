import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Bake static plant parts into one draw per material, retaining vertex colors.
 * Animals keep their separate parts for animation. Nothing is shared between
 * instances, so disposal and translucent placement previews remain safe. */
export function batchStaticAsset(root: THREE.Group): THREE.Group {
  const batches = new Map<
    string,
    { material: THREE.MeshStandardMaterial; geometries: THREE.BufferGeometry[] }
  >();
  const originalGeometries = new Set<THREE.BufferGeometry>();
  const originalMaterials = new Set<THREE.Material>();
  root.updateMatrixWorld(true);
  root.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    const mat = part.material as THREE.MeshStandardMaterial;
    const key = [
      mat.color.getHex(),
      mat.roughness,
      mat.metalness,
      mat.side,
      mat.flatShading,
      mat.vertexColors,
    ].join(":");
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
    originalGeometries.add(part.geometry);
    originalMaterials.add(mat);
  });
  const result = new THREE.Group();
  for (const { material, geometries } of batches.values()) {
    const merged = mergeGeometries(geometries);
    if (!merged) throw new Error("Could not batch procedural asset geometry.");
    const part = new THREE.Mesh(merged, material);
    part.castShadow = part.receiveShadow = true;
    result.add(part);
    geometries.forEach((geometry) => geometry.dispose());
  }
  originalGeometries.forEach((geometry) => geometry.dispose());
  const retained = new Set(
    [...batches.values()].map((batch) => batch.material),
  );
  originalMaterials.forEach((material) => {
    if (!retained.has(material as THREE.MeshStandardMaterial))
      material.dispose();
  });
  return result;
}
