import * as THREE from "three";

/** A model baked with its own skeleton: bones as offsets from their parent,
 * and faces grouped by source color with skin weights per corner. */
export interface SkinnedModel {
  bones: { name: string; parent: number; position: number[] }[];
  parts: {
    color: string;
    positions: number[];
    skinIndex: number[];
    skinWeight: number[];
  }[];
}

/** Colors one face, given the source color of its part, its center in model
 * space, and a per-animal offset so no two animals share a pattern. */
export type Painter = (
  source: string,
  at: THREE.Vector3,
  flecks: number,
) => THREE.Color;

/** Builds a skinned, flat-shaded model painted face by face. Parts in the
 * `glossy` source color, such as eyes, get a shinier material, and an
 * `opacity` below 1 makes the rest see-through. */
export function buildSkinned(
  model: SkinnedModel,
  paint: Painter,
  random: () => number,
  glossy?: string,
  opacity = 1,
) {
  const root = new THREE.Group();
  const bones = model.bones.map((data) => {
    const bone = new THREE.Bone();
    bone.name = data.name;
    bone.position.fromArray(data.position);
    return bone;
  });
  model.bones.forEach((data, i) =>
    (data.parent < 0 ? root : bones[data.parent]).add(bones[i]),
  );
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const flecks = random() * 100;
  const skin = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.55,
    transparent: opacity < 1,
    opacity,
  });
  const shiny = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.15,
  });
  for (const part of model.parts) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(part.skinIndex, 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(part.skinWeight, 4),
    );
    geometry.computeVertexNormals();
    const position = geometry.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const center = new THREE.Vector3();
    const corner = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
      center.set(0, 0, 0);
      for (let k = 0; k < 3; k++)
        center.add(corner.fromBufferAttribute(position, i + k));
      center.divideScalar(3);
      const tone = paint(part.color, center, flecks);
      for (let k = 0; k < 3; k++)
        colors.set([tone.r, tone.g, tone.b], (i + k) * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.SkinnedMesh(
      geometry,
      part.color === glossy ? shiny : skin,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    mesh.bind(skeleton);
  }
  return root;
}
