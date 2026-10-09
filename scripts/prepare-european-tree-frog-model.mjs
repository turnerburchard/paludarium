/** Bake the European tree frog mesh into data the synchronous asset factory can
 * use: faces grouped into flat color regions, the shared frog skeleton fitted
 * to this body, and skin weights for each vertex. Fitting the shared skeleton
 * keeps the bone names and rest rotations, so the shared frog clips and
 * FrogRig drive this frog too.
 * Source: "Frog" by Poly by Google, poly.pizza/m/97NtujixdN7, CC-BY 3.0.
 * Run from the repository root: node scripts/prepare-european-tree-frog-model.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Box3, Mesh, Object3D, Vector3 } from "three";
import { loadGlb, palette } from "./glb.mjs";

const file = readFileSync(
  "docs/inspiration/models/european-tree-frog-poly-google.glb",
);
const { gltf, images } = await loadGlb(file);
const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)));
const textureOf = new Map(
  json.materials.map((material) => {
    const texture = material.pbrMetallicRoughness.baseColorTexture.index;
    return [material.name, palette(images[json.textures[texture].source])];
  }),
);
const EYE_MATERIAL = "lambert3SG";

// Same footprint as the shared frog: 0.62 wide, feet on y = 0. The source
// faces +Z and the habitat's animals face -Z, so it turns half a revolution.
const bounds = new Box3().setFromObject(gltf.scene, true);
const scale = 0.62 / (bounds.max.x - bounds.min.x);
const center = bounds.getCenter(new Vector3());
const habitat = (p) =>
  new Vector3(
    -(p.x - center.x) * scale,
    (p.y - bounds.min.y) * scale,
    -(p.z - center.z) * scale,
  );

/** Where each shared bone sits in this body, in habitat space, measured from
 * the model. Left limbs are at -X; the right side mirrors them. Bones not
 * listed keep their place in the shared rig. */
const LEFT = {
  FrontLegL: [-0.08, 0.15, -0.06],
  FrontUpLegL: [-0.11, 0.13, -0.06],
  FrontLowLegL: [-0.145, 0.085, -0.045],
  FrontLowLegL_end: [-0.14, 0.008, -0.115],
  FrontFootL: [-0.14, 0.008, -0.115],
  FrontFootL_end: [-0.14, 0.008, -0.16],
  BackHipL: [-0.06, 0.1, 0.2],
  BackLegL: [-0.12, 0.11, 0.2],
  BackUpLegL: [-0.19, 0.12, 0],
  BackLowLegL: [-0.19, 0.06, 0.21],
  BackLowLegL_end: [-0.22, 0.012, 0.08],
  BackFootL: [-0.22, 0.012, 0.08],
  BackFootL_end: [-0.23, 0.012, 0.05],
};
const RIGHT_NAME = {
  FrontLegL: "FrontLegL001",
};
const rightName = (name) =>
  RIGHT_NAME[name] ?? name.replace(/L(?=_end$|$)/, "R");
const FITTED = {
  Back: [0, 0.1, 0.24],
  Back_end: [0, 0.15, 0.17],
  Hips: [0, 0.15, 0.17],
  Torso: [0, 0.17, 0.07],
  Torso_end: [0, 0.18, -0.04],
  Shoulders: [0, 0.18, -0.04],
  Neck: [0, 0.19, -0.09],
  Head: [0, 0.2, -0.14],
  Head_end: [0, 0.21, -0.28],
  ...LEFT,
  ...Object.fromEntries(
    Object.entries(LEFT).map(([name, [x, y, z]]) => [
      rightName(name),
      [-x, y, z],
    ]),
  ),
};

// Pose the shared rig at rest to read each bone's world frame.
const shared = JSON.parse(readFileSync("src/assets/animals/frog.json"));
const nodes = shared.bones.map((data) => {
  const node = new Object3D();
  node.position.fromArray(data.position);
  node.quaternion.fromArray(data.quaternion);
  node.scale.fromArray(data.scale);
  return node;
});
const holder = new Object3D();
shared.bones.forEach((data, i) =>
  (data.parent < 0 ? holder : nodes[data.parent]).add(nodes[i]),
);
holder.updateMatrixWorld(true);
const at = new Map(
  shared.bones.map((data, i) => [
    data.name,
    FITTED[data.name]
      ? new Vector3(...FITTED[data.name])
      : nodes[i].getWorldPosition(new Vector3()),
  ]),
);

// Move each bone to its fitted spot, expressed in its parent's rest frame, so
// rest rotations and clip rotations still mean the same thing. The clips set
// the foot targets' positions outright, so each foot gets a fixed parent that
// carries the difference between where the shared rig's foot was and where
// this one's is.
const FEET = ["FrontFootL", "FrontFootR", "BackFootL", "BackFootR"];
const bones = [];
const moved = [];
shared.bones.forEach((data, i) => {
  const parent = data.parent < 0 ? holder : nodes[data.parent];
  const frame = parent.matrixWorld.clone();
  if (data.parent >= 0)
    frame.setPosition(at.get(shared.bones[data.parent].name));
  const local = at.get(data.name).clone().applyMatrix4(frame.invert());
  let parentIndex = data.parent < 0 ? -1 : moved[data.parent];
  if (FEET.includes(data.name)) {
    const rest = new Vector3().fromArray(data.position);
    bones.push({
      name: `${data.name}Mount`,
      parent: parentIndex,
      position: round(local.clone().sub(rest).toArray(), 6),
    });
    parentIndex = bones.length - 1;
    local.copy(rest);
  }
  moved[i] = bones.length;
  bones.push({
    name: data.name,
    parent: parentIndex,
    position: round(local.toArray(), 6),
    quaternion: data.quaternion,
    scale: data.scale,
  });
});
const index = (name) => bones.findIndex((bone) => bone.name === name);

/** Segments a vertex may bind to. Each moves with the bone at its start. */
const segment = (from, to) => ({
  a: at.get(from),
  b: at.get(to),
  bone: index(from),
});
const BODY = [
  segment("Head", "Head_end"),
  segment("Neck", "Head"),
  segment("Shoulders", "Neck"),
  segment("Torso", "Torso_end"),
  segment("Hips", "Torso"),
  segment("Back", "Back_end"),
];
const limbs = (side) => {
  const n = (name) => (side === "L" ? name : rightName(name));
  return [
    segment(n("FrontLegL"), n("FrontUpLegL")),
    segment(n("FrontUpLegL"), n("FrontLowLegL")),
    segment(n("FrontLowLegL"), n("FrontLowLegL_end")),
    segment(n("BackHipL"), n("BackLegL")),
    segment(n("BackLegL"), n("BackUpLegL")),
    segment(n("BackUpLegL"), n("BackLowLegL")),
    segment(n("BackLowLegL"), n("BackLowLegL_end")),
  ];
};
/** Hand and foot centerlines along the ground, left side, in x and z. The
 * hind toes reach forward past the hands, so a fixed line can't split them. */
const HAND = [new Vector3(-0.14, 0, -0.115), new Vector3(-0.14, 0, -0.24)];
const FOOT = [new Vector3(-0.2, 0, 0.15), new Vector3(-0.25, 0, -0.06)];

function weights(p) {
  const side = p.x < 0 ? "L" : "R";
  // Hands and feet stay with their foot targets so they can be planted.
  // The hind toes stand taller than the palms, and the wrist starts just
  // above them.
  const flat = new Vector3(-Math.abs(p.x), 0, p.z);
  const front =
    distanceToSegment(flat, ...HAND) < distanceToSegment(flat, ...FOOT);
  if (p.y < (front ? 0.025 : 0.04) && Math.abs(p.x) > 0.06)
    return [[index(`${front ? "Front" : "Back"}Foot${side}`), 1]];
  const scored = [...BODY, ...limbs(side)]
    .map((s) => ({ bone: s.bone, d: distanceToSegment(p, s.a, s.b) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 2);
  const inverse = scored.map(({ d }) => 1 / Math.max(d, 1e-4) ** 4);
  const total = inverse.reduce((a, b) => a + b, 0);
  return scored.map(({ bone }, i) => [bone, inverse[i] / total]);
}

// The source paints soft shading into its texture. Each face takes the color
// under its middle and falls into one flat region instead.
const faces = [];
gltf.scene.traverse((object) => {
  if (!(object instanceof Mesh)) return;
  const texture = textureOf.get(object.material.name);
  const geometry = object.geometry.toNonIndexed();
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i += 3) {
    const corners = [0, 1, 2].map((k) =>
      habitat(
        new Vector3()
          .fromBufferAttribute(position, i + k)
          .applyMatrix4(object.matrixWorld),
      ),
    );
    const u = (uv.getX(i) + uv.getX(i + 1) + uv.getX(i + 2)) / 3;
    const v = (uv.getY(i) + uv.getY(i + 1) + uv.getY(i + 2)) / 3;
    faces.push({
      corners,
      eye: object.material.name === EYE_MATERIAL,
      ...hsl(texture(u, v)),
    });
  }
});

const BACK = "back",
  BELLY = "belly",
  STRIPE = "stripe",
  IRIS = "iris",
  PUPIL = "pupil";
for (const face of faces) {
  if (face.eye) continue;
  if (face.l < 0.3 && !(face.h > 0.17 && face.h < 0.45)) face.region = STRIPE;
  else if (face.s < 0.45 || (face.h > 0.12 && face.h < 0.2 && face.l > 0.6))
    face.region = BELLY;
  else face.region = BACK;
}
// The painted pupil doesn't follow the eye's facets, so its edge comes out
// jagged. Instead, the pupil takes as many faces as the paint gave it, those
// facing most nearly the way the painted pupil looks.
for (const side of [-1, 1]) {
  const eye = faces.filter((f) => f.eye && Math.sign(middle(f).x) === side);
  const ball = eye
    .reduce((sum, f) => sum.add(middle(f)), new Vector3())
    .divideScalar(eye.length);
  const painted = eye.filter((f) => f.l < 0.3);
  const gaze = painted
    .reduce((sum, f) => sum.add(middle(f).sub(ball)), new Vector3())
    .normalize();
  const facing = (f) => middle(f).sub(ball).normalize().dot(gaze);
  eye.sort((a, b) => facing(b) - facing(a));
  eye.forEach((f, i) => (f.region = i < painted.length ? PUPIL : IRIS));
}

// The thighs fold flat against the flanks as one surface, so nearest-bone
// weights change abruptly there and the skin tears when a leg kicks. Blending
// each corner's weights with its neighbors' spreads the stretch over several
// faces. Hands and feet keep their single bone so they stay planted. More
// passes start blending the two sides across the belly.
const SMOOTHING_PASSES = 4;
const FOOT_BONES = new Set(FEET.map(index));
const key = (p) =>
  p
    .toArray()
    .map((v) => v.toFixed(5))
    .join();
const skin = new Map();
const neighbors = new Map();
for (const face of faces) {
  const keys = face.corners.map(key);
  face.corners.forEach((p, k) => {
    if (!skin.has(keys[k])) {
      const w = weights(p);
      skin.set(keys[k], {
        planted: w.length === 1 && FOOT_BONES.has(w[0][0]),
        weight: new Map(w),
      });
      neighbors.set(keys[k], new Set());
    }
    for (const other of keys)
      if (other !== keys[k]) neighbors.get(keys[k]).add(other);
  });
}
for (let pass = 0; pass < SMOOTHING_PASSES; pass++) {
  const next = new Map();
  for (const [vertex, { planted, weight }] of skin) {
    if (planted) continue;
    const blended = new Map([...weight].map(([bone, w]) => [bone, w / 2]));
    const around = [...neighbors.get(vertex)];
    for (const other of around)
      for (const [bone, w] of skin.get(other).weight)
        blended.set(bone, (blended.get(bone) ?? 0) + w / 2 / around.length);
    next.set(vertex, blended);
  }
  for (const [vertex, weight] of next) skin.get(vertex).weight = weight;
}
/** The four strongest bones for a corner, normalized. */
function strongest(p) {
  const top = [...skin.get(key(p)).weight]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const total = top.reduce((sum, [, w]) => sum + w, 0);
  return top.map(([bone, w]) => [bone, w / total]);
}

const parts = new Map();
for (const face of faces) {
  const part = parts.get(face.region) ?? {
    color: face.region,
    positions: [],
    skinIndex: [],
    skinWeight: [],
  };
  for (const p of face.corners) {
    part.positions.push(...round(p.toArray(), 5));
    const w = strongest(p);
    part.skinIndex.push(...[0, 1, 2, 3].map((n) => w[n]?.[0] ?? 0));
    part.skinWeight.push(
      ...[0, 1, 2, 3].map((n) => Number((w[n]?.[1] ?? 0).toFixed(3))),
    );
  }
  parts.set(face.region, part);
}

writeFileSync(
  "src/assets/animals/europeanTreeFrog.json",
  JSON.stringify({ bones, parts: [...parts.values()] }),
);
console.log(
  `Prepared ${faces.length} triangles: ${[...parts.values()]
    .map((p) => `${p.color} ${p.positions.length / 9}`)
    .join(", ")}; ${bones.length} bones.`,
);

function middle(face) {
  return face.corners[0]
    .clone()
    .add(face.corners[1])
    .add(face.corners[2])
    .divideScalar(3);
}
function hsl(rgb) {
  const [r, g, b] = [16, 8, 0].map((shift) => ((rgb >> shift) & 0xff) / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return { h, s, l };
}
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
