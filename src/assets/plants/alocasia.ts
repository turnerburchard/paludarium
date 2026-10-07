import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import alocasiaModel from "./alocasia.json";

export const alocasia: AssetDefinition = {
  kind: "alocasia",
  name: "Elephant ear",
  scientificName: "Alocasia odora",
  category: "Plants",
  description:
    "Tall stalks holding up huge, dark arrow-shaped leaves along shady Asian forest streams.",
  radius: 0.4,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

/** Model: "Flower Pot" by Zsky, CC-BY 3.0, without its pot. */
function build() {
  return buildBaked(alocasiaModel, () => ({ color: "#2f5a22" }));
}
