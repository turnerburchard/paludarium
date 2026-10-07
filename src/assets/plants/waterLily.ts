import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import waterLilyModel from "./waterLily.json";

export const waterLily: AssetDefinition = {
  kind: "water-lily",
  name: "Water lily",
  scientificName: "Nymphaea",
  category: "Plants",
  description:
    "A round pad and a pink flower that float on still water, giving fish shade below.",
  radius: 0.3,
  habitat: "water",
  floats: true,
  build,
};

/** Model: "Lily pad" by Poly by Google, CC-BY 3.0. */
function build() {
  return buildBaked(waterLilyModel, (role) => ({
    color: {
      pad: "#3f8f5a",
      padShade: "#2a6440",
      petal: "#c77c97",
      petalLight: "#e6b3c0",
      petalDark: "#7a3a55",
      deep: "#3a1f28",
    }[role]!,
  }));
}
