import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import monsteraModel from "./monstera.json";

export const monstera: AssetDefinition = {
  kind: "monstera",
  name: "Monstera",
  scientificName: "Monstera deliciosa",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description:
    "A climbing plant native to Mexico and Central America, with large, split leaves. Aerial roots attach it to trees and other supports.",
  radius: 0.48,
  size: 1.3,
  habitat: "land",
  shelter: true,
  soil: "damp",
  // Frogs climb each stem and rest on the middle of its leaves.
  perches: () => monsteraModel.perches,
  build,
};

/** Model: "Flower Pot" by Neko, CC-BY 3.0, without its pot. Leaves are
 * paler on top than underneath. */
const COLORS: Record<string, string> = {
  top: "#5f9440",
  mid: "#4f8239",
  under: "#3a6b33",
};

function build() {
  return buildBaked(monsteraModel, (source) => ({ color: COLORS[source] }));
}
