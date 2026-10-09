import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import boulderModel from "./quaterniusBoulder.json";
import outcropModel from "./quaterniusOutcrop.json";
import cragModel from "./quaterniusCrag.json";

export const quaterniusBoulder: AssetDefinition = {
  kind: "quaternius-boulder",
  name: "Faceted pillar",
  group: "Stone",
  biomes: ["Tropical", "Temperate", "Desert"],
  description: "A tall blue-grey stone pillar with broad, angular faces.",
  radius: 0.56,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: () => buildBaked(boulderModel, (color) => ({ color })),
};

export const quaterniusOutcrop: AssetDefinition = {
  kind: "quaternius-outcrop",
  name: "Faceted outcrop",
  group: "Stone",
  biomes: ["Tropical", "Temperate", "Desert"],
  description: "An uneven outcrop of angular blue-grey stone.",
  radius: 0.6,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: () => buildBaked(outcropModel, (color) => ({ color })),
};

export const quaterniusCrag: AssetDefinition = {
  kind: "quaternius-crag",
  name: "Faceted crag",
  group: "Stone",
  biomes: ["Tropical", "Temperate", "Desert"],
  description: "A compact blue-grey crag for rocky banks and planted slopes.",
  radius: 0.45,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: () => buildBaked(cragModel, (color) => ({ color })),
};
