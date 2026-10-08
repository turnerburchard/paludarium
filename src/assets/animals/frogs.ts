import * as THREE from "three";
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
  /** Number of dark spots scattered over the back. */
  spots?: number;
  /** Moss-like light and dark patches. */
  mottled?: boolean;
  /** Dark stripes down the back and through the eye, as on a chorus frog. */
  striped?: boolean;
  /** How much deeper and thicker than the slim base model the body and legs
   * are. Defaults to 1. */
  stout?: number;
}

export const treeFrog: AssetDefinition = {
  kind: "tree-frog",
  name: "Red-eyed tree frog",
  scientificName: "Agalychnis callidryas",
  group: "Amphibians",
  biomes: ["Tropical"],
  description:
    "A green canopy frog with scarlet eyes, striped flanks, and orange toe pads.",
  radius: 0.26,
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
        stout: 1.1,
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
  const stout = appearance.stout ?? 1;
  const legs = limbs(root, bones);
  const back = new THREE.Color(appearance.back);
  const belly = new THREE.Color(appearance.belly);
  const feet = new THREE.Color(appearance.feet);
  const dark = new THREE.Color("#112329");
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
      moveEyes(indexed, stout);
    else reshape(indexed, part.skinIndex, part.skinWeight, stout, legs);
    // Separate faces so markings can paint whole facets.
    const geometry = indexed.toNonIndexed();
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
          color.copy(dark);
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
  stout: number,
  limbs: THREE.Line3[],
) {
  const point = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const positions = geometry.getAttribute("position");
  for (let v = 0; v < positions.count; v++) {
    let trunk = 0;
    for (let k = 0; k < 4; k++)
      if (TRUNK.has(skinIndex[v * 4 + k])) trunk += skinWeight[v * 4 + k];
    fatten(point.fromBufferAttribute(positions, v), trunk * stout);
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
          -0.4 * stout * (1 - trunk) * Math.sin(nearest.along * Math.PI),
        );
    }
    positions.setXYZ(v, point.x, point.y, point.z);
  }
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

/** Deepens and slightly broadens the trunk, most just behind the shoulders
 * and tapering toward the snout. */
function fatten(point: THREE.Vector3, amount: number) {
  const girth = amount * Math.max(0, 1 - ((point.z - 0.02) / 0.32) ** 2);
  return point.set(
    point.x * (1 + 0.3 * girth),
    point.y + (point.y - 0.15) * 0.6 * girth,
    point.z,
  );
}

/** Carries each eye with the reshaped head without stretching it. */
function moveEyes(geometry: THREE.BufferGeometry, stout: number) {
  const positions = geometry.getAttribute("position");
  for (const side of [-1, 1]) {
    const eye = [];
    for (let v = 0; v < positions.count; v++)
      if (Math.sign(positions.getX(v)) === side) eye.push(v);
    const center = new THREE.Vector3();
    for (const v of eye)
      center.add(new THREE.Vector3().fromBufferAttribute(positions, v));
    center.divideScalar(eye.length);
    const offset = fatten(center.clone(), stout).sub(center);
    for (const v of eye)
      positions.setXYZ(
        v,
        positions.getX(v) + offset.x,
        positions.getY(v) + offset.y,
        positions.getZ(v) + offset.z,
      );
  }
}
