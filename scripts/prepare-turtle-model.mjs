/** Bake the turtle into face lists by color with a simple skeleton: the shell
 * rides the body, the neck, head, tail and each leg get a bone.
 * Source: "Turtle" by Poly by Google, poly.pizza/m/2LCcq8vhqJ3, CC-BY 3.0.
 * Run from the repository root: node scripts/prepare-turtle-model.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Vector3,
} from "three";
import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { loadGlb } from "./glb.mjs";

const { gltf } = await loadGlb(
  readFileSync("docs/inspiration/models/turtle-poly-google.glb"),
);
const bounds = new Box3().setFromObject(gltf.scene);
const LENGTH = 0.42;
const scale = LENGTH / (bounds.max.z - bounds.min.z);
// The source walks toward +Z; the habitat's animals face -Z and stand on y = 0.
const habitat = (x, y, z) =>
  new Vector3(-x * scale, (y - bounds.min.y) * scale, -z * scale);

/** Joints in source units: head toward +Z, feet on the ground at y -1.76. */
const JOINTS = [
  ["root", null, [0, -1.76, 0]],
  ["body", "root", [0, 2, 0]],
  ["neck", "body", [0, 2.5, 5.5]],
  ["head", "neck", [0, 4.5, 8.3]],
  ["tail", "body", [0, 0.5, -8.4]],
  ["legFL", "body", [4.3, 0.8, 4.4]],
  ["legFR", "body", [-4.3, 0.8, 4.4]],
  ["legBL", "body", [4.3, 0.8, -5.2]],
  ["legBR", "body", [-4.3, 0.8, -5.2]],
];
const at = new Map(JOINTS.map(([name, , p]) => [name, habitat(...p)]));
const bones = JOINTS.map(([name, parent]) => ({
  name,
  parent: parent === null ? -1 : JOINTS.findIndex(([n]) => n === parent),
  position: round(
    (parent
      ? at.get(name).clone().sub(at.get(parent))
      : at.get(name)
    ).toArray(),
    5,
  ),
}));
const index = (name) => JOINTS.findIndex(([n]) => n === name);
const SHELL = new Set(["612719", "895019", "baac6c"]);
const EYES = "303030";
/** The share of vertices to remove from each color; eyes and claws stay. */
const REDUCTION = { 507927: 0.55, 612719: 0.45, baac6c: 0.4 };

/** Shell and belly are rigid; skin and claws go to the nearest limb. */
function bone(source, color) {
  if (SHELL.has(color)) return index("body");
  const { x, z } = source;
  if (z > 5.2 && Math.abs(x) < 3.2) return index(z > 7.4 ? "head" : "neck");
  if (z < -7.6 && Math.abs(x) < 2.5) return index("tail");
  if (Math.abs(x) > 3.2)
    return index(`leg${z > 0 ? "F" : "B"}${x > 0 ? "L" : "R"}`);
  return index("body");
}

const parts = new Map();
gltf.scene.traverse((object) => {
  if (!(object instanceof Mesh)) return;
  const color = [object.material].flat()[0].color.getHexString();
  // Simplify offline, each color on its own so boundaries stay crisp, to
  // stay within the animal triangle budget.
  const world = object.geometry.clone().applyMatrix4(object.matrixWorld);
  const welded = mergeVertices(
    new BufferGeometry().setAttribute(
      "position",
      new Float32BufferAttribute(
        world.toNonIndexed().getAttribute("position").array,
        3,
      ),
    ),
  );
  const simplified = new SimplifyModifier().modify(
    welded,
    Math.floor(welded.getAttribute("position").count * (REDUCTION[color] ?? 0)),
  );
  const geometry = simplified.toNonIndexed();
  const position = geometry.getAttribute("position");
  const part = parts.get(color) ?? { color, positions: [], bones: [] };
  for (let i = 0; i < position.count; i += 3) {
    const corners = [0, 1, 2].map((k) =>
      new Vector3().fromBufferAttribute(position, i + k),
    );
    // A whole face moves with one bone, so faces never tear apart.
    const middle = corners
      .reduce((sum, p) => sum.add(p), new Vector3())
      .divideScalar(3);
    // The source's left eye is inside out, so it rendered as an empty socket.
    if (color === EYES && facesInward(corners, eyeCenter(position, middle.x)))
      corners.reverse();
    const owner = bone(middle, color);
    for (const p of corners) {
      part.positions.push(...round(habitat(p.x, p.y, p.z).toArray(), 5));
      part.bones.push(owner);
    }
  }
  parts.set(color, part);
});
writeFileSync(
  "src/assets/animals/turtle.json",
  JSON.stringify({ bones, parts: [...parts.values()] }),
);
console.log(
  `Prepared ${[...parts.values()].reduce((n, p) => n + p.positions.length / 9, 0)} triangles in ${parts.size} colors, ${bones.length} bones.`,
);

/** The middle of the eye on the same side of the head as `x`. */
function eyeCenter(position, x) {
  const center = new Vector3();
  let count = 0;
  for (let i = 0; i < position.count; i++) {
    if (Math.sign(position.getX(i)) !== Math.sign(x)) continue;
    center.add(new Vector3().fromBufferAttribute(position, i));
    count++;
  }
  return center.divideScalar(count);
}

function facesInward([a, b, c], center) {
  const normal = new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
  return normal.dot(a.clone().sub(center)) < 0;
}

function round(values, digits) {
  return values.map((v) => Number(v.toFixed(digits)));
}
