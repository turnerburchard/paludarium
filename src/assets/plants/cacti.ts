import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import saguaroModel from "./saguaro.json";
import organPipeModel from "./organPipe.json";
import beavertailModel from "./beavertail.json";
import chollaModel from "./cholla.json";

// Models: "CactusFlowers" 2 to 4 from the Ultimate Nature Pack and "Cactus_4"
// from the Nature Crops Pack, by Quaternius, CC0.

/** The packs' near-black greens and dusky pinks, brought in line with the
 * barrel and hedgehog cacti so the desert reads as one palette. */
const PALETTE: Record<string, string> = {
  "#4b623e": "#5f7f4f",
  "#a55582": "#d9468f",
  "#b18c52": "#c9744a",
};
const recolor = (color: string) => ({ color: PALETTE[color] });

export const saguaro: AssetDefinition = {
  kind: "saguaro",
  name: "Saguaro",
  scientificName: "Carnegiea gigantea",
  group: "Cacti & succulents",
  biomes: ["Desert"],
  description:
    "A tall ribbed column with upturned arms, crowned with pink flowers.",
  radius: 0.36,
  scaleRange: [0.8, 1.2],
  habitat: "land",
  blocksMovement: true,
  soil: "arid",
  build: () => buildBaked(saguaroModel, recolor),
};

export const organPipe: AssetDefinition = {
  kind: "organ-pipe",
  name: "Organ pipe cactus",
  scientificName: "Stenocereus thurberi",
  group: "Cacti & succulents",
  biomes: ["Desert"],
  description: "A slim column with a single arm and pink flowers at its tips.",
  radius: 0.27,
  scaleRange: [0.8, 1.2],
  habitat: "land",
  blocksMovement: true,
  soil: "arid",
  build: () => buildBaked(organPipeModel, recolor),
};

export const beavertail: AssetDefinition = {
  kind: "beavertail",
  name: "Beavertail cactus",
  scientificName: "Opuntia basilaris",
  group: "Cacti & succulents",
  biomes: ["Desert"],
  description:
    "Flat, paddle-shaped pads stacked into a loose fan, edged with magenta blooms.",
  radius: 0.22,
  scaleRange: [0.8, 1.2],
  habitat: "land",
  blocksMovement: true,
  soil: "arid",
  build: () => buildBaked(beavertailModel, recolor),
};

export const cholla: AssetDefinition = {
  kind: "cholla",
  name: "Cholla",
  scientificName: "Cylindropuntia imbricata",
  group: "Cacti & succulents",
  biomes: ["Desert"],
  description:
    "A sprawl of jointed, spiny stems with pink flowers at the ends.",
  radius: 0.3,
  scaleRange: [0.8, 1.2],
  habitat: "land",
  blocksMovement: true,
  soil: "arid",
  build: () => buildBaked(chollaModel, recolor),
};
