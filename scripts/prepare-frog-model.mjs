/** Bake the CC0 reference frog into data the synchronous asset factory can use:
 * the reshaped, simplified mesh with its skin weights, the skeleton in habitat
 * space, and the animation clips the renderer plays.
 * Run from the repository root: node scripts/prepare-frog-model.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const source = readFileSync("docs/inspiration/preferred-frog-original.glb");
const gltf = await new GLTFLoader().parseAsync(
  source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength),
  "",
);
gltf.scene.updateMatrixWorld(true);
const bounds = new Box3().setFromObject(gltf.scene);
const center = bounds.getCenter(new Vector3());
const scale = 0.62 / (bounds.max.x - bounds.min.x);
// The source faces +Z; the habitat's animal convention faces -Z, so turn it
// half a revolution about Y after centering it on its feet.
const habitat = new Matrix4()
  .makeRotationY(Math.PI)
  .multiply(new Matrix4().makeScale(scale, scale, scale))
  .multiply(new Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
const habitatPoint = (point) => point.clone().applyMatrix4(habitat);

// Every node under the armature's root bone, including the "_end" tips the
// renderer uses as leg effectors. The root carries the habitat transform so
// that the clips, which animate its descendants, keep their original values.
const rootBone = gltf.scene.getObjectByName("root");
const bones = [];
const boneIndex = new Map();
rootBone.traverse((node) => {
  boneIndex.set(node, bones.length);
  const local =
    node === rootBone
      ? habitat.clone().multiply(node.matrixWorld)
      : node.matrix.clone();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const size = new Vector3();
  local.decompose(position, quaternion, size);
  bones.push({
    name: node.name,
    parent: node === rootBone ? -1 : boneIndex.get(node.parent),
    position: round(position.toArray(), 6),
    quaternion: round(quaternion.toArray(), 6),
    scale: round(size.toArray(), 6),
  });
});

const joints = new Map();
gltf.scene.traverse((object) => {
  if (object.isBone)
    joints.set(
      object.name,
      habitatPoint(object.getWorldPosition(new Vector3())),
    );
});
const limbSegments = [
  ["FrontUpLegL", "FrontLowLegL"],
  ["FrontLowLegL", "FrontFootL"],
  ["FrontUpLegR", "FrontLowLegR"],
  ["FrontLowLegR", "FrontFootR"],
  ["BackLegL", "BackUpLegL"],
  ["BackUpLegL", "BackLowLegL"],
  ["BackLegR", "BackUpLegR"],
  ["BackUpLegR", "BackLowLegR"],
].map(([a, b]) => [joints.get(a), joints.get(b)]);
const reduction = { Green: 0.48, Yellow: 0.4, Red: 0.7, Black: 0.5 };
const parts = [];
gltf.scene.traverse((object) => {
  if (!(object instanceof Mesh)) return;
  const geometry = object.geometry;
  const positions = geometry.getAttribute("position");
  const skinIndices = geometry.getAttribute("skinIndex");
  const skinWeights = geometry.getAttribute("skinWeight");
  const index = geometry.index;
  const vertices = [];
  // Simplification only collapses vertices onto existing ones, so each
  // surviving position finds its original skin weights by exact lookup.
  const skins = new Map();
  const point = new Vector3();
  for (let i = 0; i < (index?.count ?? positions.count); i++) {
    const vertex = index ? index.getX(i) : i;
    point.fromBufferAttribute(positions, vertex);
    if (object.isSkinnedMesh) object.applyBoneTransform(vertex, point);
    point.applyMatrix4(object.matrixWorld);
    point.copy(habitatPoint(point));
    // Add substance perpendicular to the limb bones, rather than inflating the torso.
    if (Math.abs(point.x) > 0.12 && point.y > 0.025) {
      let closest;
      let distance = Infinity;
      for (const [start, end] of limbSegments) {
        const axis = end.clone().sub(start);
        const t = Math.max(
          0,
          Math.min(1, point.clone().sub(start).dot(axis) / axis.lengthSq()),
        );
        const projection = start.clone().addScaledVector(axis, t);
        const candidate = point.distanceTo(projection);
        if (candidate < distance) {
          closest = projection;
          distance = candidate;
        }
      }
      if (closest && distance < 0.04)
        point.addScaledVector(point.clone().sub(closest), 0.22);
    }
    let { x, y, z } = point;
    // Slim the upper torso, keeping the head, bent legs and foot placement intact.
    if (z > -0.09 && z < 0.15 && y > 0.1 && Math.abs(x) < 0.13) {
      const weight = Math.sin(((z + 0.09) / 0.24) * Math.PI);
      x *= 1 - 0.13 * weight;
      y -= Math.max(0, y - 0.1) * 0.1 * weight;
    }
    // Broaden the pupil from a sharp slit toward an oval, keeping its eye socket.
    if (object.material.name === "Black") {
      const eyeX = x < 0 ? -0.076 : 0.073;
      x = eyeX + (x - eyeX) * 1.4;
    }
    const baked = [x, y, z].map((v) => Math.fround(Number(v.toFixed(6))));
    vertices.push(...baked);
    const key = baked.join();
    if (!skins.has(key))
      skins.set(key, {
        index: [0, 1, 2, 3].map(
          (k) =>
            boneIndex.get(object.skeleton.bones[skinIndices.getComponent(vertex, k)]),
        ),
        weight: [0, 1, 2, 3].map((k) => skinWeights.getComponent(vertex, k)),
      });
  }
  // Simplify offline so runtime factories stay small and readable. Material
  // regions are processed separately to retain the eyes and belly color boundary.
  const baked = new BufferGeometry();
  baked.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  const welded = mergeVertices(baked);
  const simplified = new SimplifyModifier().modify(
    welded,
    Math.floor(
      welded.getAttribute("position").count * reduction[object.material.name],
    ),
  );
  const kept = simplified.getAttribute("position");
  const part = {
    material: object.material.name,
    positions: round(Array.from(kept.array), 6),
    index: Array.from(simplified.index.array),
    skinIndex: [],
    skinWeight: [],
  };
  for (let i = 0; i < kept.count; i++) {
    const skin = skins.get([kept.getX(i), kept.getY(i), kept.getZ(i)].join());
    if (!skin) throw new Error(`No skin weights for ${object.name} vertex ${i}`);
    part.skinIndex.push(...skin.index);
    part.skinWeight.push(...round(skin.weight, 3));
  }
  parts.push(part);
  baked.dispose();
  welded.dispose();
  simplified.dispose();
});

const clipNames = { idle: "Frog_Idle", jump: "Frog_Jump", attack: "Frog_Attack" };
const clips = Object.fromEntries(
  Object.entries(clipNames).map(([key, name]) => {
    const clip = gltf.animations.find((a) => a.name.endsWith(name));
    return [
      key,
      {
        duration: Number(clip.duration.toFixed(4)),
        tracks: clip.tracks.map((track) => {
          const [bone, path] = track.name.split(".");
          return {
            bone,
            path,
            times: round(Array.from(track.times), 4),
            values: round(Array.from(track.values), 5),
          };
        }),
      },
    ];
  }),
);

writeFileSync(
  "src/assets/animals/frog.json",
  JSON.stringify({ bones, parts, clips }),
);
console.log(
  `Prepared ${parts.reduce((n, p) => n + p.index.length / 3, 0)} triangles, ${bones.length} bones.`,
);

function round(values, digits) {
  return values.map((v) => Number(v.toFixed(digits)));
}
