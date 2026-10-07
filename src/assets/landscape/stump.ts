import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import stumpModel from "./stump.json";

export const stump: AssetDefinition = {
  kind: "stump",
  name: "Mossy stump",
  category: "Landscape",
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
  const root = buildBaked(stumpModel, (source) => ({
    color: source === "4b623e" ? "#5d7a33" : "#5a4535",
  }));
  root.scale.set(
    0.9 + random() * 0.2,
    0.85 + random() * 0.3,
    0.9 + random() * 0.2,
  );
  return root;
}
