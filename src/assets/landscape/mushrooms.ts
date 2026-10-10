import { buildBaked, type BakedModel } from "../baked";
import type { AssetDefinition } from "../types";
import boleteModel from "./bolete.json";
import bonnetModel from "./bonnetMushrooms.json";
import chickenModel from "./chickenOfTheWoods.json";
import flyAgaricModel from "./flyAgaric.json";
import houseplantModel from "./houseplantMushrooms.json";
import pantherModel from "./pantherCaps.json";
import parasolModel from "./parasol.json";

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

export const chickenOfTheWoods: AssetDefinition = {
  kind: "chicken-of-the-woods",
  name: "Chicken of the woods",
  scientificName: "Laetiporus sulphureus",
  group: "Mushrooms",
  biomes: ["Temperate"],
  description:
    "Overlapping orange shelves with paler, yellowish rims, a bracket fungus that grows in tiers from old hardwood.",
  radius: 0.22,
  habitat: "land",
  /** Model: "Mushroom_Laetiporus" from Quaternius's Stylized Nature MegaKit, CC0. */
  build: (random) =>
    mushroom(chickenModel, random, (source) =>
      source === "rim" ? "#e39a3e" : "#cf6a2c",
    ),
};

export const parasolMushroom: AssetDefinition = {
  kind: "parasol-mushroom",
  name: "Parasol mushroom",
  scientificName: "Macrolepiota procera",
  group: "Mushrooms",
  biomes: ["Temperate"],
  description:
    "A tall mushroom whose tan cap opens out like an umbrella, on a slim stem with a loose ring. Found in grassy clearings at the edge of woods.",
  radius: 0.15,
  habitat: "land",
  /** Model: "Mushroom" by Quaternius, CC0. */
  build: (random) =>
    mushroom(parasolModel, random, (source) =>
      source === "8f433a" ? "#a9825d" : "#e4dccb",
    ),
};

export const pantherCaps: AssetDefinition = {
  kind: "panther-caps",
  name: "Panther caps",
  scientificName: "Amanita pantherina",
  group: "Mushrooms",
  biomes: ["Temperate"],
  description:
    "A pair of brown caps dotted with white warts, close cousins of the fly agaric and just as poisonous.",
  radius: 0.17,
  habitat: "land",
  /** Model: "Mushrooms" by Danni Bittman, CC-BY 3.0. */
  build: (random) =>
    mushroom(pantherModel, random, (source) => PANTHER_CAP[source]),
};

/** Brown cap, white warts and a pale stem. */
const PANTHER_CAP: Record<string, string> = {
  f53f30: "#6e4a30",
  ffffff: "#ece6d8",
  ffcd89: "#e2d8c0",
};

export const houseplantMushrooms: AssetDefinition = {
  kind: "houseplant-mushrooms",
  name: "Yellow houseplant mushrooms",
  scientificName: "Leucocoprinus birnbaumii",
  group: "Mushrooms",
  biomes: ["Tropical"],
  description:
    "A little cluster of lemon-yellow caps on thin stems, a tropical mushroom that turns up in warm, damp potting soil.",
  radius: 0.2,
  habitat: "land",
  /** Model: "Mushroom_Common" from Quaternius's Stylized Nature MegaKit, CC0. */
  build: (random) =>
    mushroom(houseplantModel, random, (source) => HOUSEPLANT[source]),
};

/** Lemon caps over paler gills and stems. The cap's texture runs from dark
 * to light, so it needs two roles to stay apart from the stem, but two
 * shades read as a patchwork. */
const HOUSEPLANT: Record<string, string> = {
  cap: "#dcbc30",
  capTop: "#dcbc30",
  gills: "#e8d77c",
  stem: "#ede0a0",
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
