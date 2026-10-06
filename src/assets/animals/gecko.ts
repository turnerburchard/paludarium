import * as THREE from "three";
import type { AssetDefinition } from "../types";

export const gecko: AssetDefinition = {
  kind: "gecko",
  name: "Turnip-tailed gecko",
  scientificName: "Thecadactylus rapicauda",
  category: "Animals",
  description:
    "A banded, big-eyed night gecko that runs up bark and glass on broad toe pads.",
  radius: 0.5,
  habitat: "land",
  behavior: {
    nocturnal: true,
    climbs: true,
    speed: 0.07,
    movement: "scurry",
    restsOn: ["bark", "glass", "stem"],
  },
  build,
};

type Vec = readonly [number, number, number];

/** Bone name and model-space position, children after parents. Rest
 * rotations are all identity, so the rig can turn joints directly. The
 * gecko faces -Z with its belly just above y = 0. */
const SKELETON: readonly (readonly [string, string | null, Vec])[] = [
  ["root", null, [0, 0, 0]],
  ["pelvis", "root", [0, 0.07, 0.1]],
  ["spine", "pelvis", [0, 0.075, -0.02]],
  ["chest", "spine", [0, 0.075, -0.13]],
  ["neck", "chest", [0, 0.08, -0.22]],
  ["head", "neck", [0, 0.085, -0.27]],
  ["head_end", "head", [0, 0.07, -0.41]],
  ["tail1", "pelvis", [0, 0.065, 0.19]],
  ["tail2", "tail1", [0, 0.055, 0.3]],
  ["tail3", "tail2", [0, 0.045, 0.41]],
  ["tail4", "tail3", [0, 0.035, 0.51]],
  ["tail_end", "tail4", [0, 0.025, 0.62]],
  ...([1, -1] as const).flatMap((side) => {
    const s = side > 0 ? "L" : "R";
    return [
      [`upperArm${s}`, "chest", [side * 0.06, 0.065, -0.15]],
      [`forearm${s}`, `upperArm${s}`, [side * 0.11, 0.105, -0.17]],
      [`hand${s}_tip`, `forearm${s}`, [side * 0.14, 0.014, -0.19]],
      [`hand${s}`, "root", [side * 0.14, 0.014, -0.19]],
      [`thigh${s}`, "pelvis", [side * 0.055, 0.06, 0.08]],
      [`shin${s}`, `thigh${s}`, [side * 0.12, 0.105, 0.05]],
      [`foot${s}_tip`, `shin${s}`, [side * 0.15, 0.014, 0.11]],
      [`foot${s}`, "root", [side * 0.15, 0.014, 0.11]],
    ] as const;
  }),
];

/** Cross sections along the body and tail: position along Z, centre height,
 * half width and half height. Turnip-tails carry a thick tail base. */
const PROFILE: readonly (readonly [number, number, number, number])[] = [
  [-0.415, 0.06, 0.008, 0.008],
  [-0.39, 0.065, 0.03, 0.022],
  [-0.34, 0.075, 0.05, 0.034],
  [-0.29, 0.082, 0.058, 0.04],
  [-0.24, 0.08, 0.045, 0.034],
  [-0.18, 0.075, 0.062, 0.04],
  [-0.08, 0.072, 0.078, 0.045],
  [0.02, 0.07, 0.08, 0.044],
  [0.11, 0.066, 0.068, 0.04],
  [0.19, 0.06, 0.062, 0.038],
  [0.3, 0.052, 0.058, 0.035],
  [0.42, 0.043, 0.045, 0.028],
  [0.52, 0.034, 0.026, 0.018],
  [0.6, 0.027, 0.01, 0.008],
  [0.64, 0.024, 0.002, 0.002],
];
/** The bones the body and tail bend with, in order along Z. */
const SPINE = [
  "head",
  "neck",
  "chest",
  "spine",
  "pelvis",
  "tail1",
  "tail2",
  "tail3",
  "tail4",
];

function build(random: () => number) {
  const root = new THREE.Group();
  const bones = new Map<string, THREE.Bone>();
  const at = new Map<string, THREE.Vector3>();
  for (const [name, parent, position] of SKELETON) {
    const bone = new THREE.Bone();
    bone.name = name;
    const world = new THREE.Vector3(...position);
    at.set(name, world);
    bone.position.copy(parent ? world.clone().sub(at.get(parent)!) : world);
    (parent ? bones.get(parent)! : root).add(bone);
    bones.set(name, bone);
  }
  const order = [...bones.values()];
  const index = (name: string) => order.indexOf(bones.get(name)!);
  // Built at a comfortable size to model, then scaled to sit beside the frogs.
  root.scale.setScalar(0.75);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(order);

  const pattern = {
    bands: 5 + Math.floor(random() * 3),
    phase: random() * Math.PI * 2,
    tone: 0.9 + random() * 0.2,
  };
  const parts = new Part();
  body(parts, (z) => spineWeights(z, at, index));
  for (const side of [1, -1] as const) {
    const s = side > 0 ? "L" : "R";
    limb(parts, at, index, `upperArm${s}`, `forearm${s}`, `hand${s}_tip`, 0.03);
    limb(parts, at, index, `thigh${s}`, `shin${s}`, `foot${s}_tip`, 0.036);
    toes(parts, at.get(`hand${s}`)!, side, true, index(`hand${s}`), 0.045);
    toes(parts, at.get(`foot${s}`)!, side, false, index(`foot${s}`), 0.052);
  }
  const skin = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.78,
  });
  const mesh = parts.mesh(skin, (centroid, normal) =>
    skinColor(centroid, normal, pattern),
  );
  root.add(mesh);
  mesh.bind(skeleton);

  const eye = new Part();
  for (const side of [1, -1]) {
    sphere(eye, [side * 0.045, 0.098, -0.315], 0.022, index("head"));
  }
  const eyes = eye.mesh(
    new THREE.MeshStandardMaterial({ roughness: 0.25, flatShading: true }),
    (centroid) =>
      // A vertical slit pupil across the front of each golden eye.
      Math.abs(centroid.z + 0.315) < 0.016 &&
      Math.abs(Math.abs(centroid.x) - 0.064) < 0.006
        ? new THREE.Color("#1b1610")
        : new THREE.Color("#b88a3b"),
  );
  root.add(eyes);
  eyes.bind(skeleton);
  return root;
}

/** Collects triangles with one bone weighting per vertex, then builds a
 * flat-shaded skinned mesh colored face by face. */
class Part {
  private readonly positions: number[] = [];
  private readonly weights: [number, number, number, number][] = [];
  private readonly indices: [number, number, number, number][] = [];

  triangle(
    corners: readonly THREE.Vector3[],
    skins: readonly (readonly [number, number][])[],
  ) {
    for (const [i, corner] of corners.entries()) {
      this.positions.push(corner.x, corner.y, corner.z);
      const skin = [...skins[i], [0, 0], [0, 0], [0, 0]].slice(0, 4);
      this.indices.push(
        skin.map(([bone]) => bone) as [number, number, number, number],
      );
      this.weights.push(
        skin.map(([, weight]) => weight) as [number, number, number, number],
      );
    }
  }

  mesh(
    material: THREE.Material,
    color: (centroid: THREE.Vector3, normal: THREE.Vector3) => THREE.Color,
  ) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.positions, 3),
    );
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(this.indices.flat(), 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(this.weights.flat(), 4),
    );
    geometry.computeVertexNormals();
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const colors = new Float32Array(position.count * 3);
    const centroid = new THREE.Vector3();
    const facing = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
      centroid.set(0, 0, 0);
      for (let k = 0; k < 3; k++)
        centroid.add(new THREE.Vector3().fromBufferAttribute(position, i + k));
      centroid.divideScalar(3);
      facing.fromBufferAttribute(normal, i);
      const tone = color(centroid, facing);
      for (let k = 0; k < 3; k++)
        colors.set([tone.r, tone.g, tone.b], (i + k) * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    if (material instanceof THREE.MeshStandardMaterial)
      material.vertexColors = true;
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** Blend between the two spine or tail bones either side of a point. */
function spineWeights(
  z: number,
  at: ReadonlyMap<string, THREE.Vector3>,
  index: (name: string) => number,
): [number, number][] {
  const zs = SPINE.map((name) => at.get(name)!.z);
  if (z <= zs[0]) return [[index(SPINE[0]), 1]];
  for (let i = 0; i < zs.length - 1; i++)
    if (z <= zs[i + 1]) {
      const t = (z - zs[i]) / (zs[i + 1] - zs[i]);
      return [
        [index(SPINE[i]), 1 - t],
        [index(SPINE[i + 1]), t],
      ];
    }
  return [[index(SPINE.at(-1)!), 1]];
}

function body(part: Part, weights: (z: number) => [number, number][]) {
  const sides = 9;
  const rings = PROFILE.map(([z, y, w, h]) =>
    Array.from({ length: sides }, (_, i) => {
      const angle = (i / sides) * Math.PI * 2;
      // Flattened underneath, as geckos are, with a gently domed back.
      const up = Math.sin(angle);
      return new THREE.Vector3(
        Math.cos(angle) * w,
        y + (up > 0 ? up * h : up * h * 0.55),
        z,
      );
    }),
  );
  const skins = PROFILE.map(([z]) => weights(z));
  for (let r = 0; r < rings.length - 1; r++)
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a = rings[r][i],
        b = rings[r][j],
        c = rings[r + 1][i],
        d = rings[r + 1][j];
      part.triangle([a, d, b], [skins[r], skins[r + 1], skins[r]]);
      part.triangle([a, c, d], [skins[r], skins[r + 1], skins[r + 1]]);
    }
  // Close the snout.
  const tip = new THREE.Vector3(0, PROFILE[0][1], PROFILE[0][0] - 0.01);
  for (let i = 0; i < sides; i++)
    part.triangle(
      [rings[0][(i + 1) % sides], rings[0][i], tip],
      [skins[0], skins[0], skins[0]],
    );
}

/** A two-segment leg tube from shoulder or hip, bending at elbow or knee. */
function limb(
  part: Part,
  at: ReadonlyMap<string, THREE.Vector3>,
  index: (name: string) => number,
  upper: string,
  lower: string,
  tip: string,
  radius: number,
) {
  const points = [at.get(upper)!, at.get(lower)!, at.get(tip)!];
  const radii = [radius, radius * 0.8, radius * 0.6];
  const skins: [number, number][][] = [
    [[index(upper), 1]],
    [
      [index(upper), 0.5],
      [index(lower), 0.5],
    ],
    [[index(lower), 1]],
  ];
  const sides = 5;
  const rings = points.map((center, i) => {
    const axis = points[Math.min(i + 1, 2)]
      .clone()
      .sub(points[Math.max(i - 1, 0)])
      .normalize();
    const u = new THREE.Vector3().crossVectors(
      axis,
      new THREE.Vector3(0, 0, 1),
    );
    if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
    u.normalize();
    const v = new THREE.Vector3().crossVectors(axis, u).normalize();
    return Array.from({ length: sides }, (_, k) => {
      const angle = (k / sides) * Math.PI * 2;
      return center
        .clone()
        .addScaledVector(u, Math.cos(angle) * radii[i])
        .addScaledVector(v, Math.sin(angle) * radii[i]);
    });
  });
  for (let r = 0; r < 2; r++)
    for (let k = 0; k < sides; k++) {
      const j = (k + 1) % sides;
      part.triangle(
        [rings[r][k], rings[r + 1][j], rings[r][j]],
        [skins[r], skins[r + 1], skins[r]],
      );
      part.triangle(
        [rings[r][k], rings[r + 1][k], rings[r + 1][j]],
        [skins[r], skins[r + 1], skins[r + 1]],
      );
    }
}

/** Five splayed toes, each ending in a broad adhesive pad, flat on the
 * surface. Front toes fan forward and out, hind toes back and out. */
function toes(
  part: Part,
  center: THREE.Vector3,
  side: 1 | -1,
  front: boolean,
  bone: number,
  length: number,
) {
  const skin: [number, number][] = [[bone, 1]];
  // Angles in the XZ plane: 0 points back (+Z), PI points forward.
  const middle = front ? Math.PI - side * 0.6 : side * 1.2;
  const lift = new THREE.Vector3(0, 0.003, 0);
  for (let k = 0; k < 5; k++) {
    const angle = middle + (k - 2) * 0.45;
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const across = new THREE.Vector3(-dir.z, 0, dir.x);
    const base = center.clone().setY(center.y - 0.006);
    const neck = base.clone().addScaledVector(dir, length * 0.65);
    const pad = base.clone().addScaledVector(dir, length).add(lift);
    const w = length * 0.12,
      padW = length * 0.22;
    const corners = [
      base.clone().addScaledVector(across, w),
      base.clone().addScaledVector(across, -w),
      neck.clone().addScaledVector(across, w * 0.7),
      neck.clone().addScaledVector(across, -w * 0.7),
      pad.clone().addScaledVector(across, padW),
      pad.clone().addScaledVector(across, -padW),
      pad.clone().addScaledVector(dir, length * 0.18),
    ];
    for (const [a, b, c] of [
      [0, 2, 1],
      [1, 2, 3],
      [2, 4, 3],
      [3, 4, 5],
      [4, 6, 5],
    ])
      part.triangle([corners[a], corners[b], corners[c]], [skin, skin, skin]);
  }
}

function sphere(part: Part, center: Vec, radius: number, bone: number) {
  const geometry = new THREE.IcosahedronGeometry(radius, 1).toNonIndexed();
  const position = geometry.getAttribute("position");
  const skin: [number, number][] = [[bone, 1]];
  for (let i = 0; i < position.count; i += 3)
    part.triangle(
      [0, 1, 2].map((k) =>
        new THREE.Vector3()
          .fromBufferAttribute(position, i + k)
          .add(new THREE.Vector3(...center)),
      ),
      [skin, skin, skin],
    );
  geometry.dispose();
}

/** Grey-brown with darker bands across the back and tail, a pale belly, and
 * slightly darker limbs. */
function skinColor(
  centroid: THREE.Vector3,
  normal: THREE.Vector3,
  pattern: { bands: number; phase: number; tone: number },
) {
  const base = new THREE.Color("#6e624f").multiplyScalar(pattern.tone);
  if (normal.y < -0.4) return base.lerp(new THREE.Color("#c2b494"), 0.7);
  const band = Math.sin(centroid.z * pattern.bands * 6 + pattern.phase);
  const speckle = Math.sin(centroid.x * 140 + centroid.z * 97) * 0.5 + 0.5;
  if (Math.abs(centroid.x) > 0.09) base.multiplyScalar(0.85);
  if (band > 0.55) base.lerp(new THREE.Color("#3a3128"), 0.6);
  return base.multiplyScalar(0.92 + speckle * 0.16);
}
