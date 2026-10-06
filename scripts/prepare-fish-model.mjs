/** Bake the CC0 Quaternius fish, its skeleton and swim clip, into data the
 * synchronous asset factory can use for the tiger barb. Source: "Fish" by Quaternius,
 * poly.pizza/m/BEcU9rjiAq, CC0.
 * Run from the repository root: node scripts/prepare-fish-model.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Box3, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import { loadGlb } from "./glb.mjs";

const { gltf } = await loadGlb(
  readFileSync("docs/inspiration/models/fish-quaternius.glb"),
);
const bounds = new Box3();
gltf.scene.traverse((object) => {
  if (!(object instanceof Mesh)) return;
  const position = object.geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++)
    bounds.expandByPoint(
      new Vector3()
        .fromBufferAttribute(position, i)
        .applyMatrix4(object.matrixWorld),
    );
});
const center = bounds.getCenter(new Vector3());
const LENGTH = 0.19;
const scale = LENGTH / (bounds.max.z - bounds.min.z);
// The source swims toward +Z; the habitat's fish face -Z, centred on their
// body so they swim at the depth the school sets.
const habitat = new Matrix4()
  .makeRotationY(Math.PI)
  .multiply(new Matrix4().makeScale(scale, scale, scale))
  .multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));

const rootBone = gltf.scene.getObjectByName("Root");
const bones = [];
const boneIndex = new Map();
rootBone.traverse((node) => {
  boneIndex.set(node, bones.length);
  const local =
    node === rootBone
      ? habitat.clone().multiply(node.matrixWorld)
      : node.matrix.clone();
  const position = new Vector3(),
    quaternion = new Quaternion(),
    size = new Vector3();
  local.decompose(position, quaternion, size);
  bones.push({
    name: node.name,
    parent: node === rootBone ? -1 : boneIndex.get(node.parent),
    position: round(position.toArray(), 6),
    quaternion: round(quaternion.toArray(), 6),
    scale: round(size.toArray(), 6),
  });
});

const parts = [];
gltf.scene.traverse((object) => {
  if (!object.isSkinnedMesh) return;
  const geometry = object.geometry;
  const position = geometry.getAttribute("position");
  const skinIndex = geometry.getAttribute("skinIndex");
  const skinWeight = geometry.getAttribute("skinWeight");
  const index = geometry.index;
  const part = {
    material: object.material.name,
    positions: [],
    skinIndex: [],
    skinWeight: [],
  };
  // One entry per triangle corner, so faces can be colored separately.
  for (let corner = 0; corner < (index?.count ?? position.count); corner++) {
    const i = index ? index.getX(corner) : corner;
    const p = new Vector3().fromBufferAttribute(position, i);
    object.applyBoneTransform(i, p);
    p.applyMatrix4(object.matrixWorld).applyMatrix4(habitat);
    part.positions.push(...round(p.toArray(), 5));
    for (let k = 0; k < 4; k++) {
      part.skinIndex.push(
        boneIndex.get(object.skeleton.bones[skinIndex.getComponent(i, k)]),
      );
      part.skinWeight.push(Number(skinWeight.getComponent(i, k).toFixed(3)));
    }
  }
  parts.push(part);
});

const swim = gltf.animations[0];
writeFileSync(
  "src/assets/animals/barb.json",
  JSON.stringify({
    bones,
    parts,
    swim: {
      duration: Number(swim.duration.toFixed(4)),
      // The root carries the turn and scale above, so only the body bends.
      tracks: swim.tracks
        .filter((track) => !track.name.startsWith("Root."))
        .map((track) => {
          const [bone, path] = track.name.split(".");
          return {
            bone,
            path,
            times: round(Array.from(track.times), 4),
            values: round(Array.from(track.values), 5),
          };
        }),
    },
  }),
);
console.log(
  `Prepared ${parts.reduce((n, p) => n + p.positions.length / 9, 0)} triangles, ${bones.length} bones.`,
);

function round(values, digits) {
  return values.map((v) => Number(v.toFixed(digits)));
}
