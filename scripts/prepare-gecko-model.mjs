/** Bake the gecko mesh into data the synchronous asset factory can use: faces
 * grouped by palette color, a skeleton fitted to the model's anatomy, and
 * skin weights for each vertex.
 * Source: "Salamander" (Tex_Gecko) by Poly by Google, poly.pizza/m/eqjMAgmr-pM, CC-BY 3.0.
 * Run from the repository root: node scripts/prepare-gecko-model.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Box3, Mesh, Vector3 } from "three";
import { loadGlb, palette } from "./glb.mjs";

const { gltf, images } = await loadGlb(
  readFileSync("docs/inspiration/models/gecko-poly-google.glb"),
);
const color = palette(images[0]);
const bounds = new Box3().setFromObject(gltf.scene);
const LENGTH = 0.82;
const scale = LENGTH / (bounds.max.z - bounds.min.z);
// The source faces +Z with its feet at the bottom of its bounds; the habitat's
// animals face -Z and stand on y = 0, so it turns half a revolution.
const habitat = (p) =>
  new Vector3(-p.x * scale, (p.y - bounds.min.y) * scale, -p.z * scale);
const source = (x, y, z) => habitat(new Vector3(x, y, z));

/** Joints in source units, measured from the model: head toward +Z, front
 * feet at z 30, hind feet at z -3, tail to -62. Bone names match GeckoRig. */
const JOINTS = [
  ["root", null, [0, -13.2, 0]],
  ["pelvis", "root", [0, -3, -3]],
  ["spine", "pelvis", [0, -1, 11]],
  ["chest", "spine", [0, 0, 26]],
  ["neck", "chest", [0, 3, 36]],
  ["head", "neck", [0, 6, 43]],
  ["head_end", "head", [0, 6, 62]],
  ["tail1", "pelvis", [0, -4, -16]],
  ["tail2", "tail1", [0, -5, -28]],
  ["tail3", "tail2", [0, -5.5, -40]],
  ["tail4", "tail3", [0, -6, -51]],
  ["tail_end", "tail4", [0, -6, -61.4]],
  ...[1, -1].flatMap((side) => {
    // The habitat flips X, so the source's -X is the gecko's left.
    const s = side > 0 ? "R" : "L";
    return [
      [`upperArm${s}`, "chest", [side * 6, -2, 27]],
      [`forearm${s}`, `upperArm${s}`, [side * 15, 2, 26.5]],
      [`hand${s}_tip`, `forearm${s}`, [side * 24, -12.5, 29]],
      [`hand${s}`, "root", [side * 24, -12.5, 29]],
      [`thigh${s}`, "pelvis", [side * 6, -4, -2]],
      [`shin${s}`, `thigh${s}`, [side * 15, 2, -1.5]],
      [`foot${s}_tip`, `shin${s}`, [side * 24, -12.5, -2]],
      [`foot${s}`, "root", [side * 24, -12.5, -2]],
    ];
  }),
];
const at = new Map(JOINTS.map(([name, , p]) => [name, source(...p)]));
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

/** Segments a vertex may bind to, by which part of the body it is on. */
const SPINE = [
  "head_end",
  "head",
  "neck",
  "chest",
  "spine",
  "pelvis",
  "tail1",
  "tail2",
  "tail3",
  "tail4",
  "tail_end",
];
const segments = (names) =>
  names.slice(0, -1).map((name, i) => {
    // Each segment moves with the bone at its start, toward the tail or tip.
    const [a, b] = [at.get(name), at.get(names[i + 1])];
    const owner = i === 0 && names[0] === "head_end" ? "head" : name;
    return { a, b, bone: index(owner) };
  });
const body = segments(SPINE).filter((s) => s.bone >= 0);
const limbs = (s) => ({
  front: segments([`upperArm${s}`, `forearm${s}`, `hand${s}_tip`]),
  hind: segments([`thigh${s}`, `shin${s}`, `foot${s}_tip`]),
});

function weights(p) {
  const side = p.x > 0 ? "L" : "R";
  const front = p.z < (at.get("chest").z + at.get("pelvis").z) / 2;
  const spread = Math.abs(p.x);
  // Feet stay with their foot bones so they can be planted.
  if (p.y < 0.02 && spread > 0.11)
    return [[index(front ? `hand${side}` : `foot${side}`), 1]];
  const candidates =
    spread > 0.06 ? limbs(side)[front ? "front" : "hind"] : body;
  const scored = candidates
    .map((s) => ({ bone: s.bone, d: distanceToSegment(p, s.a, s.b) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 2);
  const inverse = scored.map(({ d }) => 1 / Math.max(d, 1e-4) ** 4);
  const total = inverse.reduce((a, b) => a + b, 0);
  return scored.map(({ bone }, i) => [bone, inverse[i] / total]);
}

const parts = new Map();
gltf.scene.traverse((object) => {
  if (!(object instanceof Mesh)) return;
  const geometry = object.geometry.toNonIndexed();
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i += 3) {
    // A face takes the palette color at its first corner.
    const key = color(uv.getX(i), uv.getY(i)).toString(16).padStart(6, "0");
    const part = parts.get(key) ?? {
      color: key,
      positions: [],
      skinIndex: [],
      skinWeight: [],
    };
    for (let k = 0; k < 3; k++) {
      const p = habitat(
        new Vector3()
          .fromBufferAttribute(position, i + k)
          .applyMatrix4(object.matrixWorld),
      );
      part.positions.push(...round(p.toArray(), 5));
      const w = weights(p);
      part.skinIndex.push(...[0, 1, 2, 3].map((n) => w[n]?.[0] ?? 0));
      part.skinWeight.push(
        ...[0, 1, 2, 3].map((n) => Number((w[n]?.[1] ?? 0).toFixed(3))),
      );
    }
    parts.set(key, part);
  }
});

writeFileSync(
  "src/assets/animals/gecko.json",
  JSON.stringify({ bones, parts: [...parts.values()] }),
);
console.log(
  `Prepared ${[...parts.values()].reduce((n, p) => n + p.positions.length / 9, 0)} triangles in ${parts.size} colors, ${bones.length} bones.`,
);

function distanceToSegment(p, a, b) {
  const axis = b.clone().sub(a);
  const t = Math.max(
    0,
    Math.min(1, p.clone().sub(a).dot(axis) / axis.lengthSq()),
  );
  return p.distanceTo(a.clone().addScaledVector(axis, t));
}
function round(values, digits) {
  return values.map((v) => Number(v.toFixed(digits)));
}
