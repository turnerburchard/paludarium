import * as THREE from "three";
import { branch, material, mesh } from "../geometry";
import { placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const rotala: AssetDefinition = {
  kind: "rotala",
  name: "Rotala",
  scientificName: "Rotala rotundifolia",
  category: "Plants",
  description:
    "A bunch of slender stems with small round leaves that blush pink toward the light.",
  radius: 0.24,
  habitat: "water",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.6);
  skin.vertexColors = true;
  const stem = material("#7b8a45");
  const green = new THREE.Color("#5e9a3c"),
    pink = new THREE.Color("#d9788a");
  const stems = 14 + Math.floor(random() * 5);
  for (let i = 0; i < stems; i++) {
    const angle = random() * Math.PI * 2,
      reach = Math.sqrt(random()) * 0.12;
    const base = new THREE.Vector3(
      Math.cos(angle) * reach,
      0,
      Math.sin(angle) * reach,
    );
    const height = 0.55 + random() * 0.45;
    const top = base
      .clone()
      .add(
        new THREE.Vector3(
          (random() - 0.5) * 0.2,
          height,
          (random() - 0.5) * 0.2,
        ),
      );
    branch(root, base, top, 0.008, stem, 0.006);
    // Pairs of leaves up the stem, each pair turned a quarter from the last.
    const pairs = 9;
    for (let p = 1; p <= pairs; p++) {
      const t = p / (pairs + 0.5);
      const at = base.clone().lerp(top, t);
      const tone = green.clone().lerp(pink, Math.max(0, (t - 0.55) / 0.45));
      for (const side of [-1, 1]) {
        const turn = angle + (p % 2) * (Math.PI / 2) + (side > 0 ? 0 : Math.PI);
        const out = new THREE.Vector3(Math.cos(turn), 0.5, Math.sin(turn));
        const length = 0.06 + (1 - t) * 0.025;
        const leaf = mesh(roundLeaf(length, tone), skin, root);
        placeLeaf(leaf, at, out, new THREE.Vector3(0, 1, 0));
      }
    }
  }
  return root;
}

/** A tiny rounded leaf as four faceted triangles, along +Y facing +Z. Rotala
 * carries hundreds, so each stays as light as it can. */
function roundLeaf(length: number, color: THREE.Color) {
  const half = length * 0.35;
  const tip = new THREE.Vector3(0, length, 0),
    base = new THREE.Vector3(),
    middle = new THREE.Vector3(0, length * 0.5, half * 0.6);
  const left = new THREE.Vector3(-half, length * 0.45, 0),
    right = new THREE.Vector3(half, length * 0.45, 0);
  const geometry = new THREE.BufferGeometry().setFromPoints([
    base,
    middle,
    left,
    base,
    right,
    middle,
    middle,
    tip,
    left,
    middle,
    right,
    tip,
  ]);
  const colors = new Float32Array(12 * 3);
  for (let i = 0; i < 12; i++) colors.set([color.r, color.g, color.b], i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
