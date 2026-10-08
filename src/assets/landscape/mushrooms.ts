import { buildBaked, type BakedModel } from "../baked";
import type { AssetDefinition } from "../types";
import boleteModel from "./bolete.json";
import bonnetModel from "./bonnetMushrooms.json";
import flyAgaricModel from "./flyAgaric.json";

export const bolete: AssetDefinition = {
  kind: "bolete",
  name: "King bolete",
  scientificName: "Boletus edulis",
  group: "Mushrooms",
  biomes: ["Temperate"],
  description:
    "A stout mushroom with a glossy brown cap on a fat white stem, pushing up through the needles under conifers.",
  radius: 0.13,
  habitat: "land",
  /** Model: "Mushroom" by Сергей Тиньков, CC-BY 3.0. */
  build: (random) =>
    mushroom(boleteModel, random, (source) =>
      source === "745534" ? "#7a4f2c" : "#e2dccd",
    ),
};

export const flyAgaric: AssetDefinition = {
  kind: "fly-agaric",
  name: "Fly agaric",
  scientificName: "Amanita muscaria",
  group: "Mushrooms",
  biomes: ["Temperate"],
  description:
    "The classic toadstool: a scarlet cap flecked with white, on a pale stem. Beautiful and poisonous.",
  radius: 0.16,
  habitat: "land",
  /** Model: "Mushroom" by jeremy, CC-BY 3.0. */
  build: (random) =>
    mushroom(flyAgaricModel, random, (source) => FLY_AGARIC[source]),
};

/** Scarlet cap, white stem and spots, and cream gills. */
const FLY_AGARIC: Record<string, string> = {
  f53f30: "#c2332a",
  ffffff: "#ece6d8",
  ffcd89: "#e3cfa0",
};

export const bonnetMushrooms: AssetDefinition = {
  kind: "bonnet-mushrooms",
  name: "Bonnet mushrooms",
  scientificName: "Mycena galericulata",
  group: "Mushrooms",
  biomes: ["Tropical", "Temperate"],
  description:
    "A damp clump of slender grey-brown mushrooms with little bell-shaped caps, growing from rotting wood and leaf litter.",
  radius: 0.21,
  habitat: "land",
  /** Model: "Mushroom" by Quaternius, CC0. */
  // Its texture shades each face differently, which reads as a patchwork,
  // so the whole clump takes one grey-brown.
  build: (random) => mushroom(bonnetModel, random, () => "#a38f80"),
};

/** A baked mushroom, each one a little taller or squatter than the last. */
function mushroom(
  model: BakedModel,
  random: () => number,
  colorOf: (source: string) => string,
) {
  const root = buildBaked(model, (source) => ({ color: colorOf(source) }));
  const spread = 0.9 + random() * 0.2;
  root.scale.set(spread, 0.85 + random() * 0.3, spread);
  return root;
}
