import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import cattailModel from "./cattail.json";

export const cattail: AssetDefinition = {
  kind: "cattail",
  name: "Cattail",
  scientificName: "Typha latifolia",
  group: "Grasses",
  biomes: ["Temperate", "Desert"],
  description:
    "Tall reeds with velvety brown seed heads, right at the water's edge.",
  radius: 0.32,
  habitat: "either",
  shelter: true,
  soil: "shore",
  build,
};

/** Model: "Cattail" by Poly by Google, CC-BY 3.0. */
function build() {
  return buildBaked(cattailModel, (source) => ({
    // Its leaves are a dusty reed green and its heads a deep brown.
    color: source === "7c3800" ? "#6a3f1d" : "#6f8f4f",
  }));
}
