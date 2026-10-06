/** Bake the CC0 reference's rest pose for the existing synchronous asset factory.
 * The original GLB and animation rig remain in docs/inspiration for later rig work.
 * Run from the repository root: node scripts/prepare-frog-model.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
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
function habitatPoint(point) {
  return new Vector3(
    -(point.x - center.x) * scale,
    (point.y - bounds.min.y) * scale,
    -(point.z - center.z) * scale,
  );
}
const bones = new Map();
gltf.scene.traverse((object) => {
  if (object.isBone)
    bones.set(
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
].map(([a, b]) => [bones.get(a), bones.get(b)]);
const reduction = { Green: 0.48, Yellow: 0.4, Red: 0.7, Black: 0.5 };
const parts = [];
gltf.scene.traverse((object) => {
  if (!(object instanceof Mesh)) return;
  const geometry = object.geometry;
  const positions = geometry.getAttribute("position");
  const index = geometry.index;
  const vertices = [];
  const point = new Vector3();
  for (let i = 0; i < (index?.count ?? positions.count); i++) {
    const vertex = index ? index.getX(i) : i;
    point.fromBufferAttribute(positions, vertex);
    if (object.isSkinnedMesh) object.applyBoneTransform(vertex, point);
    point.applyMatrix4(object.matrixWorld);
    // The source faces +Z; the habitat's animal convention faces -Z.
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
    vertices.push(...[x, y, z].map((v) => Number(v.toFixed(6))));
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
  const flat = simplified.toNonIndexed();
  parts.push({
    material: object.material.name,
    positions: Array.from(flat.getAttribute("position").array, (v) =>
      Number(v.toFixed(6)),
    ),
  });
  baked.dispose();
  welded.dispose();
  simplified.dispose();
  flat.dispose();
});
writeFileSync("src/assets/animals/frog.json", JSON.stringify(parts));
console.log(
  `Prepared ${parts.reduce((n, p) => n + p.positions.length / 9, 0)} triangles.`,
);
