import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import treeRootsModel from "./treeRoots.json";

export const treeRoots: AssetDefinition = {
  kind: "tree-roots",
  name: "Tree roots",
  group: "Wood",
  biomes: ["Tropical"],
  description:
    "The fallen base of a sunken tree, its dark roots spread over the bottom where small fish weave between them.",
  radius: 0.55,
  habitat: "either",
  hardscape: "wood",
  blocksMovement: true,
  build,
};

/** Model: "Tree roots" by Poly by Google, CC-BY 3.0. */
function build(random: () => number) {
  // Soaked wood darkens to a deep brown, paler where the trunk broke off.
  const colors: Record<string, string> = {
    wood: "#4f3b2b",
    cut: "#6e5640",
    dark: "#2a1f17",
  };
  const root = buildBaked(treeRootsModel, (source) => ({
    color: colors[source],
  }));
  root.scale.set(
    0.9 + random() * 0.2,
    0.85 + random() * 0.3,
    0.9 + random() * 0.2,
  );
  return root;
}
