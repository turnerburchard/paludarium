import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import hairgrassModel from "./hairgrass.json";

export const hairgrass: AssetDefinition = {
  kind: "hairgrass",
  name: "Tufted hairgrass",
  scientificName: "Deschampsia cespitosa",
  category: "Plants",
  description:
    "Soft, fine tussocks that crowd wet mountain meadows and creek banks.",
  radius: 0.26,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

/** Model: "Grass" by Quaternius, CC0, the larger clump. */
function build() {
  return buildBaked(hairgrassModel, (role) => ({
    color: { dark: "#3c5420", mid: "#5b7030", light: "#869a48" }[role]!,
  }));
}
