import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import treePhilodendronModel from "./treePhilodendron.json";

export const treePhilodendron: AssetDefinition = {
  kind: "tree-philodendron",
  name: "Lacy tree philodendron",
  scientificName: "Thaumatophyllum bipinnatifidum",
  category: "Plants",
  description:
    "Deeply lobed, glossy leaves spreading from a short trunk on the rainforest floor.",
  radius: 0.45,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

/** Model: "Houseplant" by Quaternius, CC0, without its pot and darkened. */
function build() {
  return buildBaked(treePhilodendronModel, () => ({ color: "#3b6a2a" }));
}
