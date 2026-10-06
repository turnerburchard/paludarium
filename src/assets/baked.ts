import * as THREE from "three";
import { material, mesh } from "./geometry";

/** A downloaded model baked by scripts/prepare-static-models.mjs: faces
 * grouped by their source color. */
export interface BakedModel {
  parts: { color: string; positions: number[] }[];
}

/** Builds each color group as its own flat-shaded mesh, recolored by
 * `colorOf`, so callers can restyle a model and animate its parts. */
export function buildBaked(
  model: BakedModel,
  colorOf: (source: string) => { color: string; name?: string },
) {
  const root = new THREE.Group();
  for (const part of model.parts) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    geometry.computeVertexNormals();
    const { color, name } = colorOf(part.color);
    const object = mesh(geometry, material(color, 0.75), root);
    if (name) object.name = name;
  }
  return root;
}
