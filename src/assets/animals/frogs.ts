import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { AssetDefinition } from "../types";
import frogModel from "./frog.json";

interface Appearance {
  back: string;
  belly: string;
  iris: string;
  feet: string;
  height: number;
  size: number;
  roughness: number;
  /** Number of spots scattered over the back. */
  spots?: number;
  /** Color of the spots. Defaults to near black. */
  markings?: string;
  /** Moss-like light and dark patches. */
  mottled?: boolean;
  /** Dark stripes down the back and through the eye, as on a chorus frog. */
  striped?: boolean;
  /** Bumpy, tubercled skin over the back, as on a mossy frog. */
  tubercles?: boolean;
  /** A pointed flap over each eye, as on a horned frog. */
  horns?: boolean;
  shape?: Shape;
}

/** How a frog departs from the slim base model. Width and depth fatten the
 * trunk, most just behind the shoulders; head broadens the skull and jaw;
 * legs thickens the limbs. */
interface Shape {
  width: number;
  depth: number;
  head?: number;
  legs: number;
}

/** The forest-floor build most frogs share. */
const plump: Shape = { width: 0.3, depth: 0.6, legs: 1 };
/** A lean climber with a narrow waist and slender limbs. */
const climber: Shape = { width: 0.08, depth: 0.25, legs: 0.45 };
/** Wide and round from above, on heavy legs, like a toad. */
const squat: Shape = { width: 0.75, depth: 0.55, legs: 1.4 };
/** Nearly as wide as long, mostly mouth, on short stubby legs. */
const globe: Shape = { width: 1, depth: 0.8, head: 0.9, legs: 1.5 };

export const treeFrog: AssetDefinition = {
  kind: "tree-frog",
  name: "Red-eyed tree frog",
  scientificName: "Agalychnis callidryas",
  group: "Amphibians",
  biomes: ["Tropical"],
  description:
    "A green canopy frog with scarlet eyes, striped flanks, and orange toe pads.",
  radius: 0.26,
  size: 0.7,
  habitat: "land",
  behavior: { nocturnal: true, climbs: true, speed: 0.045, movement: "climb" },
  build: (random) =>
    buildFrog(
      {
        back: "#57902f",
        belly: "#d2d0a0",
        iris: "#b73519",
        feet: "#dc852b",
        height: 1.08,
        size: 0.8,
        roughness: 0.68,
        shape: climber,
      },
      random,
    ),
};

export const strawberryPoisonFrog: AssetDefinition = {
  kind: "dart-frog",
  name: "Strawberry poison frog",
  scientificName: "Oophaga pumilio",
  group: "Amphibians",
  biomes: ["Tropical"],
  description:
    "A small Central American frog, shown in a red and blue-legged color form.",
  radius: 0.14,
  size: 0.8,
  habitat: "land",
  behavior: { nocturnal: false, climbs: false, speed: 0.04, movement: "hop" },
  build: (random) =>
    buildFrog(
      {
        back: "#d34a25",
        belly: "#ae5234",
        iris: "#191b18",
        feet: "#245b78",
        height: 0.88,
        size: 0.42,
        roughness: 0.7,
        spots: 14,
      },
      random,
    ),
};

export const bluePoisonDartFrog: AssetDefinition = {
  kind: "blue-dart-frog",
  name: "Blue poison dart frog",
  scientificName: "Dendrobates tinctorius · azureus morph",
  group: "Amphibians",
  biomes: ["Tropical"],
  description:
    "Cobalt skin with individual dark spots. A striking forest-floor frog.",
  radius: 0.21,
  size: 0.85,
  habitat: "land",
  behavior: { nocturnal: false, climbs: false, speed: 0.035, movement: "hop" },
  build: (random) =>
    buildFrog(
      {
        back: "#1958b1",
        belly: "#3171bb",
        iris: "#10171e",
        feet: "#143c83",
        height: 0.88,
        size: 0.62,
        roughness: 0.65,
        spots: 28,
      },
      random,
    ),
};

export const mossyFrog: AssetDefinition = {
  kind: "mossy-frog",
  name: "Vietnamese mossy frog",
  scientificName: "Theloderma corticale",
  group: "Amphibians",
  biomes: ["Tropical"],
  description:
    "A squat, rough-skinned frog with moss-like green and brown camouflage.",
  radius: 0.32,
  size: 0.75,
  habitat: "land",
  behavior: {
    nocturnal: true,
    climbs: true,
    speed: 0.025,
    movement: "crawl",
    maxPerchHeight: 0.65,
  },
  build: (random) =>
    buildFrog(
      {
        back: "#3b5426",
        belly: "#4d4b30",
        iris: "#7a6a3c",
        feet: "#2b3620",
        height: 0.9,
        size: 0.95,
        roughness: 0.86,
        mottled: true,
        tubercles: true,
        shape: squat,
      },
      random,
    ),
};

export const canyonTreeFrog: AssetDefinition = {
  kind: "canyon-tree-frog",
  name: "Canyon tree frog",
  scientificName: "Dryophytes arenicolor",
  group: "Amphibians",
  biomes: ["Temperate", "Desert"],
  description:
    "A small, granite-grey frog with dark blotches that clings to boulders beside desert streams.",
  radius: 0.21,
  size: 0.85,
  habitat: "land",
  behavior: {
    nocturnal: true,
    climbs: true,
    speed: 0.04,
    movement: "climb",
    restsOn: ["stone"],
  },
  build: (random) =>
    buildFrog(
      {
        back: "#6f6a5b",
        belly: "#d6ccb0",
        iris: "#8f7d4f",
        feet: "#a08b62",
        height: 0.95,
        size: 0.6,
        roughness: 0.82,
        spots: 30,
        shape: squat,
      },
      random,
    ),
};

export const chorusFrog: AssetDefinition = {
  kind: "chorus-frog",
  name: "Boreal chorus frog",
  scientificName: "Pseudacris maculata",
  group: "Amphibians",
  biomes: ["Temperate"],
  description:
    "A small brown frog with dark stripes down its back. Lives in moist meadows and forests near wetlands, breeding in shallow pools and ponds. Its call sounds like a thumb running over the teeth of a comb.",
  radius: 0.16,
  size: 0.9,
  habitat: "land",
  behavior: { nocturnal: true, climbs: false, speed: 0.04, movement: "hop" },
  build: (random) =>
    buildFrog(
      {
        back: "#7d7350",
        belly: "#d9d0ac",
        iris: "#9a7a3c",
        feet: "#6f6748",
        height: 0.95,
        size: 0.45,
        roughness: 0.72,
        striped: true,
        shape: squat,
      },
      random,
    ),
};

export const westernToad: AssetDefinition = {
  kind: "western-toad",
  name: "Western toad",
  scientificName: "Anaxyrus boreas",
  group: "Amphibians",
  biomes: ["Temperate"],
  description:
    "A warty, olive-brown toad of mountain meadows and forest near water. It walks rather than hops, and hunts at night.",
  radius: 0.36,
  habitat: "land",
  behavior: { nocturnal: true, climbs: false, speed: 0.03, movement: "crawl" },
  build: (random) =>
    buildFrog(
      {
        back: "#6b6248",
        belly: "#d8cfb4",
        iris: "#b08a3a",
        feet: "#5f573f",
        height: 0.92,
        size: 1,
        roughness: 0.9,
        spots: 18,
        markings: "#2e271b",
        tubercles: true,
        shape: squat,
      },
      random,
    ),
};

export const hornedFrog: AssetDefinition = {
  kind: "horned-frog",
  name: "Cranwell's horned frog",
  scientificName: "Ceratophrys cranwelli",
  group: "Amphibians",
  biomes: ["Tropical"],
  description:
    "A round, wide-mouthed frog from the Gran Chaco, green with brown blotches. It sits half buried in leaf litter and ambushes anything that passes.",
  radius: 0.36,
  habitat: "land",
  behavior: { nocturnal: true, climbs: false, speed: 0.012, movement: "crawl" },
  build: (random) =>
    buildFrog(
      {
        back: "#7a9a3a",
        belly: "#d6cfa8",
        iris: "#a5772e",
        feet: "#6d8a34",
        height: 0.95,
        size: 0.84,
        roughness: 0.7,
        spots: 22,
        markings: "#4a3a22",
        horns: true,
        shape: globe,
      },
      random,
    ),
};

/** The source rig's clips, shared by every frog. They animate bones by name. */
export const frogClips = Object.fromEntries(
  Object.entries(frogModel.clips).map(([name, clip]) => [
    name,
    new THREE.AnimationClip(
      name,
      clip.duration,
      clip.tracks.map((track) =>
        track.path === "quaternion"
          ? new THREE.QuaternionKeyframeTrack(
              `${track.bone}.quaternion`,
              track.times,
              track.values,
            )
          : new THREE.VectorKeyframeTrack(
              `${track.bone}.${track.path}`,
              track.times,
              track.values,
            ),
      ),
    ),
  ]),
) as Record<keyof typeof frogModel.clips, THREE.AnimationClip>;

/** Artist-authored silhouette, topology and rig; colors vary without changing saved IDs.
 * Source: Quaternius, poly.pizza/m/9Z2V8fpazF, CC0.
 * scripts/prepare-frog-model.mjs bakes the mesh, skin weights, skeleton and clips.
 */
function buildFrog(appearance: Appearance, random: () => number) {
  const root = new THREE.Group();
  const bones = frogModel.bones.map((data) => {
    const bone = new THREE.Bone();
    bone.name = data.name;
    bone.position.fromArray(data.position);
    bone.quaternion.fromArray(data.quaternion);
    bone.scale.fromArray(data.scale);
    return bone;
  });
  frogModel.bones.forEach((data, i) =>
    (data.parent < 0 ? root : bones[data.parent]).add(bones[i]),
  );
  // Scale before binding so the skeleton's rest pose includes the proportions.
  root.scale.set(
    appearance.size,
    appearance.height * appearance.size,
    appearance.size,
  );
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const shape = appearance.shape ?? plump;
  const legs = limbs(root, bones);
  const back = new THREE.Color(appearance.back);
  const belly = new THREE.Color(appearance.belly);
  const feet = new THREE.Color(appearance.feet);
  const dark = new THREE.Color("#112329");
  const markings = appearance.markings
    ? new THREE.Color(appearance.markings)
    : dark;
  const mossLight = new THREE.Color("#7f9a3a");
  const mossDark = new THREE.Color("#141c12");
  const spots = Array.from({ length: appearance.spots ?? 0 }, () => ({
    x: (random() - 0.5) * 0.28,
    z: (random() - 0.5) * 0.43,
    radius: 0.009 + random() * 0.019,
    stretch: 0.65 + random() * 0.7,
  }));

  for (const part of frogModel.parts) {
    const indexed = new THREE.BufferGeometry();
    indexed.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    indexed.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(part.skinIndex, 4),
    );
    indexed.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(part.skinWeight, 4),
    );
    indexed.setIndex(part.index);
    if (part.material === "Red" || part.material === "Black")
      moveEyes(indexed, shape);
    else reshape(indexed, part.skinIndex, part.skinWeight, shape, legs);
    // Separate faces so markings can paint whole facets.
    let geometry = indexed.toNonIndexed();
    if (part.material === "Green") {
      const extras = [
        ...(appearance.tubercles ? [tubercles(indexed, random)] : []),
        ...(appearance.horns ? [horns(shape)] : []),
      ];
      if (extras.length) {
        const merged = mergeGeometries([geometry, ...extras]);
        if (!merged) throw new Error("Could not merge frog skin.");
        [geometry, ...extras].forEach((piece) => piece.dispose());
        geometry = merged;
      }
    }
    indexed.dispose();
    geometry.computeVertexNormals();
    const skin = part.material === "Green";
    const baseColor =
      part.material === "Yellow"
        ? belly
        : part.material === "Red"
          ? new THREE.Color(appearance.iris)
          : part.material === "Black"
            ? dark
            : back;
    const material = new THREE.MeshStandardMaterial({
      color: skin ? "#ffffff" : baseColor,
      vertexColors: skin,
      flatShading: true,
      metalness: 0,
      roughness: skin
        ? appearance.roughness
        : part.material === "Red" || part.material === "Black"
          ? 0.28
          : 0.75,
    });
    if (skin) {
      const positions = geometry.getAttribute("position");
      const colors = new Float32Array(positions.count * 3);
      const color = new THREE.Color();
      // Paint whole faces so markings reinforce the broad planes, not a tiled grid.
      for (let i = 0; i < positions.count; i += 3) {
        const x =
          (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) /
          3;
        const y =
          (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) /
          3;
        const z =
          (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) /
          3;
        color.copy(back);
        if (Math.abs(x) > 0.12 && y < 0.11) color.copy(feet);
        else if (appearance.striped && stripe(x, y, z)) color.copy(dark);
        else if (
          y > 0.1 &&
          spots.some(
            (spot) =>
              Math.hypot((x - spot.x) / spot.stretch, (z - spot.z) * 0.8) <
              spot.radius,
          )
        )
          color.copy(markings);
        else if (appearance.mottled) {
          const mottling =
            Math.sin(x * 40 + Math.sin(z * 29) * 2) * Math.cos(z * 41 - y * 43);
          color.lerp(
            mottling > 0 ? mossLight : mossDark,
            Math.abs(mottling) * 0.9,
          );
        }
        for (let corner = 0; corner < 3; corner++)
          colors.set([color.r, color.g, color.b], (i + corner) * 3);
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    mesh.bind(skeleton);
  }
  return root;
}

/** Three broken stripes down the back, and a band from the snout through the
 * eye along each flank. */
function stripe(x: number, y: number, z: number) {
  if (y > 0.17 && z > -0.13)
    return [-0.055, 0, 0.055].some(
      (line) => Math.abs(x - line) < 0.014 && Math.sin(z * 45) > -0.5,
    );
  return Math.abs(x) > 0.07 && Math.abs(y - 0.2 + (z + 0.16) * 0.3) < 0.018;
}

/** Bones of the head and body, as opposed to the legs and feet. */
const TRUNK = new Set(
  ["Body", "Back", "Shoulders", "Neck", "Head", "Hips", "Torso"].map((name) =>
    frogModel.bones.findIndex((bone) => bone.name === name),
  ),
);

/** Deepens the body and thickens the legs before the mesh binds, so the rig
 * and clips still fit. */
function reshape(
  geometry: THREE.BufferGeometry,
  skinIndex: number[],
  skinWeight: number[],
  shape: Shape,
  limbs: THREE.Line3[],
) {
  const point = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const positions = geometry.getAttribute("position");
  for (let v = 0; v < positions.count; v++) {
    let trunk = 0;
    for (let k = 0; k < 4; k++)
      if (TRUNK.has(skinIndex[v * 4 + k])) trunk += skinWeight[v * 4 + k];
    fatten(point.fromBufferAttribute(positions, v), trunk, shape);
    if (trunk < 0.5) {
      let nearest = { distance: Infinity, along: 0, at: new THREE.Vector3() };
      for (const limb of limbs) {
        const along = limb.closestPointToPointParameter(point, true);
        const distance = point.distanceTo(limb.at(along, closest));
        if (distance < nearest.distance)
          nearest = { distance, along, at: closest.clone() };
      }
      // Thicken along each bone but leave the toes and joints slender.
      if (nearest.distance < 0.05)
        point.lerp(
          nearest.at,
          -0.4 * shape.legs * (1 - trunk) * Math.sin(nearest.along * Math.PI),
        );
    }
    positions.setXYZ(v, point.x, point.y, point.z);
  }
}

/** Warts per unit of skin area on a tubercled frog. */
const WART_DENSITY = 450;

/** A low dome of unit radius, as a flat list of triangle corners. */
const WART = (() => {
  const dome = new THREE.IcosahedronGeometry(1, 0).scale(1, 0.6, 1);
  const position = dome.getAttribute("position");
  return Array.from({ length: position.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(position, i),
  );
})();

/** Low warts over the back and flanks, spread evenly by area so the fine mesh
 * around the head isn't crowded. Each is skinned like the nearest corner of
 * the face it grows from, so it moves with the body. */
function tubercles(skin: THREE.BufferGeometry, random: () => number) {
  const positions = skin.getAttribute("position");
  const skinIndex = skin.getAttribute("skinIndex");
  const skinWeight = skin.getAttribute("skinWeight");
  const index = skin.getIndex()!;
  const warts = {
    positions: [] as number[],
    skinIndex: [] as number[],
    skinWeight: [] as number[],
  };
  const triangle = new THREE.Triangle();
  const normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let face = 0; face < index.count; face += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => index.getX(face + k));
    triangle.setFromAttributeAndIndices(positions, a, b, c);
    triangle.getNormal(normal);
    const count = Math.floor(triangle.getArea() * WART_DENSITY + random());
    for (let wart = 0; wart < count; wart++) {
      const u = random(),
        w = random() * (1 - u);
      const center = triangle.a
        .clone()
        .multiplyScalar(1 - u - w)
        .addScaledVector(triangle.b, u)
        .addScaledVector(triangle.c, w);
      if (center.y < 0.13 || normal.y < 0.1) continue;
      const shares = [1 - u - w, u, w];
      const nearest = [a, b, c][shares.indexOf(Math.max(...shares))];
      const radius = 0.01 + random() * 0.012;
      const facing = new THREE.Quaternion()
        .setFromUnitVectors(up, normal)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(up, random() * Math.PI),
        );
      for (const corner of WART) {
        const point = corner
          .clone()
          .multiplyScalar(radius)
          .applyQuaternion(facing)
          .add(center);
        warts.positions.push(point.x, point.y, point.z);
        for (let k = 0; k < 4; k++) {
          warts.skinIndex.push(skinIndex.getComponent(nearest, k));
          warts.skinWeight.push(skinWeight.getComponent(nearest, k));
        }
      }
    }
  }
  return skinned(warts.positions, warts.skinIndex, warts.skinWeight);
}

const HEAD = frogModel.bones.findIndex((bone) => bone.name === "Head");

/** Eye centers of the base model. */
const EYES = [-1, 1].map((side) => {
  const eye = frogModel.parts.find((part) => part.material === "Red")!;
  const center = new THREE.Vector3();
  let count = 0;
  for (let i = 0; i < eye.positions.length; i += 3)
    if (Math.sign(eye.positions[i]) === side) {
      center.add(new THREE.Vector3().fromArray(eye.positions, i));
      count++;
    }
  return center.divideScalar(count);
});

/** A three-sided point over each eye, swept up and back, riding the head. */
function horns(shape: Shape) {
  const positions: number[] = [];
  for (const eye of EYES) {
    const center = fatten(eye.clone(), 1, shape);
    const apex = center.clone().add(new THREE.Vector3(0, 0.085, 0.025));
    const base = [0, 1, 2].map((i) => {
      const angle = (i / 3) * Math.PI * 2;
      return center
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(angle) * 0.02,
            0.03,
            Math.sin(angle) * 0.02,
          ),
        );
    });
    for (let i = 0; i < 3; i++)
      positions.push(
        ...apex.toArray(),
        ...base[i].toArray(),
        ...base[(i + 1) % 3].toArray(),
      );
  }
  const count = positions.length / 3;
  return skinned(
    positions,
    Array.from({ length: count }, () => [HEAD, 0, 0, 0]).flat(),
    Array.from({ length: count }, () => [1, 0, 0, 0]).flat(),
  );
}

function skinned(
  positions: number[],
  skinIndex: number[],
  skinWeight: number[],
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute(skinIndex, 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute(skinWeight, 4),
  );
  return geometry;
}

/** Upper and lower leg bones as segments in the frog's own space. */
function limbs(root: THREE.Object3D, bones: THREE.Bone[]) {
  const toRoot = root.matrixWorld.clone().invert();
  const at = (bone: THREE.Bone) =>
    new THREE.Vector3()
      .setFromMatrixPosition(bone.matrixWorld)
      .applyMatrix4(toRoot);
  return bones
    .filter(
      (bone) => /(Up|Low)Leg/.test(bone.name) && !bone.name.endsWith("_end"),
    )
    .map(
      (bone) => new THREE.Line3(at(bone), at(bone.children[0] as THREE.Bone)),
    );
}

/** Deepens and broadens the trunk, most just behind the shoulders and
 * tapering toward the snout, and widens the head of broad-mouthed frogs. */
function fatten(point: THREE.Vector3, trunk: number, shape: Shape) {
  const girth = trunk * Math.max(0, 1 - ((point.z - 0.02) / 0.32) ** 2);
  // The head lies toward -z, from just ahead of the shoulders to the snout.
  const jaw = trunk * THREE.MathUtils.clamp((-0.02 - point.z) / 0.15, 0, 1);
  return point.set(
    point.x * (1 + shape.width * girth + (shape.head ?? 0) * jaw),
    point.y + (point.y - 0.15) * shape.depth * girth,
    point.z,
  );
}

/** Carries each eye with the reshaped head without stretching it. */
function moveEyes(geometry: THREE.BufferGeometry, shape: Shape) {
  const positions = geometry.getAttribute("position");
  for (const side of [-1, 1]) {
    const eye = [];
    for (let v = 0; v < positions.count; v++)
      if (Math.sign(positions.getX(v)) === side) eye.push(v);
    const center = new THREE.Vector3();
    for (const v of eye)
      center.add(new THREE.Vector3().fromBufferAttribute(positions, v));
    center.divideScalar(eye.length);
    const offset = fatten(center.clone(), 1, shape).sub(center);
    for (const v of eye)
      positions.setXYZ(
        v,
        positions.getX(v) + offset.x,
        positions.getY(v) + offset.y,
        positions.getZ(v) + offset.z,
      );
  }
}
