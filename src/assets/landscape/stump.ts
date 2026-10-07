import * as THREE from "three";
import { bakedGeometry } from "../baked";
import { material, mesh } from "../geometry";
import type { AssetDefinition } from "../types";
import { dome, mossMaterial, mossTone } from "./mosses";
import stumpModel from "./stump.json";

export const stump: AssetDefinition = {
  kind: "stump",
  name: "Mossy stump",
  group: "Wood",
  biomes: ["Tropical", "Temperate"],
  description:
    "The rotting stump of a fallen tree, its hollow top filled with moss. Insects breed in the soft wood.",
  radius: 0.4,
  habitat: "either",
  hardscape: "wood",
  blocksMovement: true,
  shelter: true,
  build,
};

/** Model: "Tree Stump with Moss" by Quaternius, CC0. */
function build(random: () => number) {
  const root = new THREE.Group();
  const skin = mossMaterial();
  for (const part of stumpModel.parts) {
    const geometry = bakedGeometry(part);
    if (part.color !== "4b623e") {
      mesh(geometry, material("#5a4535", 0.75), root);
      continue;
    }
    // The model fills the hollow with one flat disc. Mottle it and heap
    // cushions of moss on top so it reads as moss rather than still water.
    mottle(geometry, random);
    mesh(geometry, skin, root);
    const bounds = discBounds(geometry);
    const center = bounds.getCenter(new THREE.Vector3());
    const reach = Math.min(bounds.max.x - center.x, bounds.max.z - center.z);
    const cushions = 7 + Math.floor(random() * 3);
    for (let i = 0; i < cushions; i++) {
      const angle = random() * Math.PI * 2,
        out = Math.sqrt(random()) * reach * 0.6;
      const size = reach * (0.35 + random() * 0.25);
      mesh(
        dome(size, size * 0.6, random() < 0.5 ? "sheet" : "fern", random),
        skin,
        root,
        [
          center.x + Math.cos(angle) * out,
          center.y - 0.01,
          center.z + Math.sin(angle) * out,
        ],
      );
    }
  }
  root.scale.set(
    0.9 + random() * 0.2,
    0.85 + random() * 0.3,
    0.9 + random() * 0.2,
  );
  return root;
}

function mottle(geometry: THREE.BufferGeometry, random: () => number) {
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 3) {
    const color = mossTone("sheet", random);
    for (let k = 0; k < 3; k++)
      colors.set([color.r, color.g, color.b], (i + k) * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

/** The upward-facing faces only: the moss color also covers a leaf on the
 * stump's twig, which would lift the cushions off the disc. */
function discBounds(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const bounds = new THREE.Box3();
  const corners = [0, 1, 2].map(() => new THREE.Vector3());
  for (let i = 0; i < position.count; i += 3) {
    corners.forEach((corner, k) => corner.fromBufferAttribute(position, i + k));
    const [a, b, c] = corners;
    const normal = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3());
    if (normal.y > 0.9)
      corners.forEach((corner) => bounds.expandByPoint(corner));
  }
  return bounds;
}
