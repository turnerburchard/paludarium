import * as THREE from "three";
import type { AssetDefinition } from "../types";
import turtleModel from "./turtle.json";

export const turtle: AssetDefinition = {
  kind: "turtle",
  name: "Painted wood turtle",
  scientificName: "Rhinoclemmys pulcherrima",
  group: "Reptiles",
  biomes: ["Tropical"],
  description:
    "A slow, domed forest turtle that browses fallen fruit and leaves on the ground.",
  radius: 0.28,
  habitat: "land",
  behavior: {
    nocturnal: false,
    climbs: false,
    speed: 0.016,
    movement: "crawl",
    grazes: true,
  },
  build: () =>
    build({
      "895019": "#6e4a2a", // shell plates
      "612719": "#33210f", // seams between the plates
      baac6c: "#c8ad66", // belly
      "507927": "#6d6b3e", // skin
      "191919": "#2b2721", // claws
      "303030": "#141414", // eyes
    }),
};

export const desertTortoise: AssetDefinition = {
  kind: "desert-tortoise",
  name: "Desert tortoise",
  scientificName: "Gopherus agassizii",
  group: "Reptiles",
  biomes: ["Desert"],
  description:
    "A patient, sand-colored tortoise that grazes on grasses and cactus flowers and rests out the heat in the shade.",
  radius: 0.28,
  habitat: "land",
  behavior: {
    nocturnal: false,
    climbs: false,
    speed: 0.012,
    movement: "crawl",
    grazes: true,
  },
  build: () =>
    build({
      "895019": "#8a7450",
      "612719": "#4d3e29",
      baac6c: "#c2ab78",
      "507927": "#8c7d62",
      "191919": "#3a332a",
      "303030": "#141414",
    }),
};

/** Model: "Turtle" by Poly by Google, CC-BY 3.0, recolored.
 * scripts/prepare-turtle-model.mjs bakes it with one bone per face.
 * `colors` maps each source color to the species' own. */
function build(colors: Record<string, string>) {
  const root = new THREE.Group();
  const bones = turtleModel.bones.map((data) => {
    const bone = new THREE.Bone();
    bone.name = data.name;
    bone.position.fromArray(data.position);
    return bone;
  });
  turtleModel.bones.forEach((data, i) =>
    (data.parent < 0 ? root : bones[data.parent]).add(bones[i]),
  );
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const part of turtleModel.parts) {
    const color = colors[part.color];
    if (!color) throw new Error(`Unexpected turtle color ${part.color}.`);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(
        part.bones.flatMap((bone) => [bone, 0, 0, 0]),
        4,
      ),
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(
        part.bones.flatMap(() => [1, 0, 0, 0]),
        4,
      ),
    );
    geometry.computeVertexNormals();
    const mesh = new THREE.SkinnedMesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness: part.color === "303030" ? 0.2 : 0.7,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    mesh.bind(skeleton);
  }
  return root;
}
