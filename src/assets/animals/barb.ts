import * as THREE from "three";
import type { AssetDefinition } from "../types";
import barbModel from "./barb.json";

export const tigerBarb: AssetDefinition = {
  kind: "tiger-barb",
  name: "Tiger barb",
  scientificName: "Puntigrus tetrazona",
  group: "Fish",
  biomes: ["Tropical"],
  description:
    "A lively gold fish with four black bands, quick in a busy school.",
  radius: 0.12,
  habitat: "water",
  swims: { speed: 0.32, depth: 0.16 },
  build,
};

/** The model's swim clip, which bends the spine and tail. */
export const barbSwim = new THREE.AnimationClip(
  "swim",
  barbModel.swim.duration,
  barbModel.swim.tracks.map(
    (track) =>
      new THREE.QuaternionKeyframeTrack(
        `${track.bone}.${track.path}`,
        track.times,
        track.values,
      ),
  ),
);

/** Each source material by its role in a tiger barb's colors. */
const COLORS: Record<string, string> = {
  Body: "#e3a23a",
  Stripes: "#1c1b18",
  Outline: "#24201a",
};

/** Model: "Fish" by Quaternius, CC0, recolored as a tiger barb.
 * scripts/prepare-fish-model.mjs bakes the mesh, skeleton and swim clip. */
function build() {
  const root = new THREE.Group();
  const bones = barbModel.bones.map((data) => {
    const bone = new THREE.Bone();
    bone.name = data.name;
    bone.position.fromArray(data.position);
    bone.quaternion.fromArray(data.quaternion);
    bone.scale.fromArray(data.scale);
    return bone;
  });
  barbModel.bones.forEach((data, i) =>
    (data.parent < 0 ? root : bones[data.parent]).add(bones[i]),
  );
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const part of barbModel.parts) {
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
    const color = COLORS[part.material];
    if (!color) throw new Error(`Unexpected barb material ${part.material}.`);
    const mesh = new THREE.SkinnedMesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness: 0.45,
      }),
    );
    mesh.castShadow = true;
    root.add(mesh);
    mesh.bind(skeleton);
  }
  return root;
}
