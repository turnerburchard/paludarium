import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import deadTreeModel from "./deadTree.json";

export const deadTree: AssetDefinition = {
  kind: "dead-tree",
  name: "Dead tree",
  category: "Landscape",
  description:
    "A small tree long dead and bleached grey by the sun, its bare branches still reaching out over the sand.",
  radius: 0.4,
  habitat: "land",
  hardscape: "wood",
  blocksMovement: true,
  build,
};

/** Model: "Dead Tree Trunk" by Zsky, CC-BY 3.0. */
function build(random: () => number) {
  const root = buildBaked(deadTreeModel, () => ({ color: "#6e6458" }));
  root.scale.set(
    0.9 + random() * 0.2,
    0.85 + random() * 0.3,
    0.9 + random() * 0.2,
  );
  return root;
}
