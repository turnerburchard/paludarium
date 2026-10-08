import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import hedgehogCactusModel from "./hedgehogCactus.json";

export const hedgehogCactus: AssetDefinition = {
  kind: "hedgehog-cactus",
  name: "Hedgehog cactus",
  scientificName: "Echinocereus engelmannii",
  group: "Cacti & succulents",
  biomes: ["Desert"],
  description:
    "A spiny little column that opens big magenta flowers in spring.",
  radius: 0.2,
  scaleRange: [0.7, 1.3],
  habitat: "land",
  blocksMovement: true,
  soil: "arid",
  build,
};

/** Model: "Cactus" by Poly by Google, CC-BY 3.0. */
function build() {
  return buildBaked(hedgehogCactusModel, (role) => ({
    color: {
      body: "#6b7f3a",
      shade: "#3e4f22",
      spine: "#e3d9a8",
      center: "#e8c84a",
      petal: "#d9468f",
      petalDark: "#9c2f66",
    }[role]!,
  }));
}
