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
}

export const treeFrog: AssetDefinition = {
  kind: "tree-frog",
  name: "Red-eyed tree frog",
  scientificName: "Agalychnis callidryas",
  category: "Animals",
  description:
    "A green canopy frog with scarlet eyes, striped flanks, and orange toe pads.",
  radius: 0.24,
  habitat: "land",
  frog: { nocturnal: true, climbs: true, speed: 0.045, movement: "climb" },
  build: (random) =>
    buildFrog(
      {
        back: "#57902f",
        belly: "#d2d0a0",
        iris: "#b73519",
        feet: "#dc852b",
        height: 1.08,
        size: 0.75,
        roughness: 0.68,
      },
      random,
    ),
};

export const strawberryPoisonFrog: AssetDefinition = {
  kind: "dart-frog",
  name: "Strawberry poison frog",
  scientificName: "Oophaga pumilio",
  category: "Animals",
  description:
    "A small Central American frog, shown in a red and blue-legged color form.",
  radius: 0.2,
  habitat: "land",
  frog: { nocturnal: false, climbs: false, speed: 0.04, movement: "hop" },
  build: (random) =>
    buildFrog(
      {
        back: "#d34a25",
        belly: "#ae5234",
        iris: "#191b18",
        feet: "#245b78",
        height: 0.88,
        size: 0.6,
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
  category: "Animals",
  description:
    "Cobalt skin with individual dark spots. A striking forest-floor frog.",
  radius: 0.26,
  habitat: "land",
  frog: { nocturnal: false, climbs: false, speed: 0.035, movement: "hop" },
  build: (random) =>
    buildFrog(
      {
        back: "#1958b1",
        belly: "#3171bb",
        iris: "#10171e",
        feet: "#143c83",
        height: 0.88,
        size: 0.75,
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
  category: "Animals",
  description:
    "A squat, rough-skinned frog with moss-like green and brown camouflage.",
  radius: 0.28,
  habitat: "land",
  frog: {
    nocturnal: true,
    climbs: true,
    speed: 0.025,
    movement: "crawl",
    maxPerchHeight: 0.65,
  },
  build: (random) =>
    buildFrog(
      {
        back: "#53683b",
        belly: "#7b7a4e",
        iris: "#88794b",
        feet: "#424b30",
        height: 0.9,
        size: 0.84,
        roughness: 0.86,
        mottled: true,
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
  const back = new THREE.Color(appearance.back);
  const belly = new THREE.Color(appearance.belly);
  const feet = new THREE.Color(appearance.feet);
  const dark = new THREE.Color("#112329");
  const mossLight = new THREE.Color("#92904d");
  const mossDark = new THREE.Color("#202d21");
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
            Math.abs(mottling) * 0.65,
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
