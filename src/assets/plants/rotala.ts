import * as THREE from "three";
import { branch, material, mesh } from "../geometry";
import { placeLeaf, roundLeaf } from "../leaves";
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
  return stemBunch(random, {
    stems: 14,
    pairs: 9,
    leaf: 0.06,
    green: "#5e9a3c",
    tip: "#d9788a",
    blush: 0.55,
  });
}

/** A planted bunch of upright stems with paired leaves. */
export interface StemBunch {
  /** At least this many stems, up to four more. */
  stems: number;
  pairs: number;
  /** Length of the top leaves. Lower leaves grow a little longer. */
  leaf: number;
  green: string;
  /** The color the leaves turn toward the top, from `blush` of the way up. */
  tip: string;
  blush: number;
}

export function stemBunch(random: () => number, spec: StemBunch) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.6);
  skin.vertexColors = true;
  const stem = material("#7b8a45");
  const green = new THREE.Color(spec.green),
    tip = new THREE.Color(spec.tip);
  const stems = spec.stems + Math.floor(random() * 5);
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
    for (let p = 1; p <= spec.pairs; p++) {
      const t = p / (spec.pairs + 0.5);
      const at = base.clone().lerp(top, t);
      const tone = green
        .clone()
        .lerp(tip, Math.max(0, (t - spec.blush) / (1 - spec.blush)));
      for (const side of [-1, 1]) {
        const turn = angle + (p % 2) * (Math.PI / 2) + (side > 0 ? 0 : Math.PI);
        const out = new THREE.Vector3(Math.cos(turn), 0.5, Math.sin(turn));
        const length = spec.leaf + (1 - t) * 0.025;
        const leaf = mesh(roundLeaf(length, tone), skin, root);
        placeLeaf(leaf, at, out, new THREE.Vector3(0, 1, 0));
      }
    }
  }
  return root;
}
