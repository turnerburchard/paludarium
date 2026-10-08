import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import alocasiaModel from "./alocasia.json";

export const alocasia: AssetDefinition = {
  kind: "alocasia",
  name: "Elephant ear",
  scientificName: "Alocasia odora",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description:
    "Tall stalks holding up huge, dark arrow-shaped leaves along shady Asian forest streams.",
  radius: 0.45,
  size: 1,
  scaleRange: [0.7, 1.4],
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

const GREENS = ["#2f5a22", "#3a6a29", "#28501d", "#44752f"];

/** Model: "Big Leaf Plant" by reyshapes, CC0. Each leaf is its own part, so
 * neighboring leaves take different greens. */
function build() {
  return buildBaked(alocasiaModel, (source) => ({
    color: GREENS[Number(source.split(".")[1]) % GREENS.length],
  }));
}
