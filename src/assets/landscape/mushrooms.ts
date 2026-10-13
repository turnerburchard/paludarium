import * as THREE from "three";
import { buildBaked, type BakedModel } from "../baked";
import type { AssetDefinition } from "../types";
import boleteModel from "./bolete.json";
import bonnetModel from "./bonnetMushrooms.json";
import bracketModel from "./bracketShelves.json";
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
  supportsAnimals: true,
  flexibility: 0.02,
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
  supportsAnimals: true,
  flexibility: 0.02,
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
  supportsAnimals: true,
  flexibility: 0.02,
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
  supportsAnimals: true,
  flexibility: 0.02,
  build: (random) =>
    bracket(random, {
      shelves: [3, 6],
      step: 0.045,
      thickness: 1,
      colors: {
        bands: ["#c9662b", "#cf6e2e", "#d67a33", "#de8a3a"],
        under: "#d98f42",
      },
    }),
};

export const turkeyTail: AssetDefinition = {
  kind: "turkey-tail",
  name: "Turkey tail",
  scientificName: "Trametes versicolor",
  group: "Mushrooms",
  biomes: ["Temperate"],
  description:
    "Thin, leathery brown fans, banded from dark to light, packed in tight tiers on dead branches and stumps.",
  radius: 0.16,
  size: 0.7,
  habitat: "land",
  supportsAnimals: true,
  flexibility: 0.02,
  build: (random) =>
    bracket(random, {
      shelves: [5, 6],
      step: 0.035,
      thickness: 0.45,
      colors: {
        bands: ["#5e4a3c", "#665142", "#705a49", "#7c6652"],
        under: "#86725e",
      },
    }),
};

export const reishi: AssetDefinition = {
  kind: "reishi",
  name: "Reishi",
  scientificName: "Ganoderma lucidum",
  group: "Mushrooms",
  biomes: ["Tropical", "Temperate"],
  description:
    "A few thick, lacquered red-brown shelves, growing from the base of dying hardwoods.",
  radius: 0.2,
  habitat: "land",
  supportsAnimals: true,
  flexibility: 0.02,
  build: (random) =>
    bracket(random, {
      shelves: [2, 3],
      largest: 4,
      step: 0.06,
      thickness: 1.25,
      colors: {
        bands: ["#6e261b", "#77291d", "#823222", "#8e3c27"],
        under: "#9a5434",
      },
    }),
};

export const oysterMushrooms: AssetDefinition = {
  kind: "oyster-mushrooms",
  name: "Oyster mushrooms",
  scientificName: "Pleurotus ostreatus",
  group: "Mushrooms",
  biomes: ["Temperate"],
  description:
    "Smooth grey-brown caps shaped like oyster shells, overlapping in clusters on fallen logs.",
  radius: 0.22,
  habitat: "land",
  supportsAnimals: true,
  flexibility: 0.02,
  build: (random) =>
    bracket(random, {
      shelves: [3, 5],
      step: 0.035,
      thickness: 0.8,
      colors: {
        bands: ["#8f877b", "#968e81", "#9e9688", "#a8a091"],
        under: "#b4ac9c",
      },
    }),
};

export const pinkOysterMushrooms: AssetDefinition = {
  kind: "pink-oyster-mushrooms",
  name: "Pink oyster mushrooms",
  scientificName: "Pleurotus djamor",
  group: "Mushrooms",
  biomes: ["Tropical"],
  description:
    "Ruffled, rosy oyster mushrooms that crowd together on rotting wood in warm, wet forests.",
  radius: 0.22,
  habitat: "land",
  supportsAnimals: true,
  flexibility: 0.02,
  build: (random) =>
    bracket(random, {
      shelves: [3, 5],
      step: 0.035,
      thickness: 0.8,
      colors: {
        bands: ["#b08a88", "#b6918f", "#bd9996", "#c4a29e"],
        under: "#cbaea8",
      },
    }),
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
  supportsAnimals: true,
  flexibility: 0.02,
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
  supportsAnimals: true,
  flexibility: 0.02,
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
  supportsAnimals: true,
  flexibility: 0.02,
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

interface BracketGrowth {
  /** The fewest and most shelves it grows. */
  shelves: readonly [number, number];
  /** Grows only from this many of the largest shelves. */
  largest?: number;
  /** About how far each shelf sits above the one below it. */
  step: number;
  /** Stretches each shelf's height, thin for leathery fans. */
  thickness: number;
  /** Its top, in bands from where it grows out to the edge, and its
   * underside. Neighboring shades stay close, so a shelf reads as one piece. */
  colors: {
    bands: readonly [string, string, string, string];
    under: string;
  };
}

/** A bracket fungus stacked from the shelves of "Mushroom_Laetiporus" in
 * Quaternius's Stylized Nature MegaKit (CC0), in a different order and fan
 * for every seed, so no two clusters look alike. */
function bracket(random: () => number, growth: BracketGrowth) {
  const [fewest, most] = growth.shelves;
  const count = fewest + Math.floor(random() * (most - fewest + 1));
  const pool = bracketModel.shelves.slice(0, growth.largest);
  const chosen = pool
    .map((shelf, i) => ({ shelf, i, order: random() }))
    .sort((a, b) => a.order - b.order)
    .slice(0, count)
    // Larger shelves come first, so they grow at the bottom.
    .sort((a, b) => a.i - b.i);
  const root = new THREE.Group();
  let y = 0;
  let angle = random() * 2 * Math.PI;
  for (const { shelf } of chosen) {
    const piece = buildBaked(shelf, (source) => ({
      color:
        source === "under"
          ? growth.colors.under
          : growth.colors.bands[Number(source.slice("band".length))],
    }));
    const bottom = new THREE.Box3().setFromObject(piece).min.y;
    piece.scale.y = growth.thickness;
    piece.position.y = y - bottom * growth.thickness;
    piece.rotation.y = angle;
    root.add(piece);
    y += growth.step * (0.7 + random() * 0.6);
    // Near the golden angle, so shelves fan out instead of lining up.
    angle += 2.4 + (random() - 0.5) * 0.8;
  }
  const spread = 0.9 + random() * 0.2;
  root.scale.set(spread, 1, spread);
  return root;
}

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
