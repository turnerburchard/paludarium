import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import boulderModel from "./quaterniusBoulder.json";
import outcropModel from "./quaterniusOutcrop.json";
import cragModel from "./quaterniusCrag.json";
import wedgeModel from "./quaterniusWedge.json";
import domeModel from "./quaterniusDome.json";
import blockModel from "./quaterniusBlock.json";
import ledgeModel from "./quaterniusLedge.json";

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

export const quaterniusWedge: AssetDefinition = {
  kind: "quaternius-wedge",
  name: "Faceted wedge",
  group: "Stone",
  biomes: ["Tropical", "Temperate", "Desert"],
  description: "A leaning wedge of blue-grey stone with one sheer face.",
  radius: 0.38,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: () => buildBaked(wedgeModel, (color) => ({ color })),
};

export const quaterniusDome: AssetDefinition = {
  kind: "quaternius-dome",
  name: "Faceted dome",
  group: "Stone",
  biomes: ["Tropical", "Temperate", "Desert"],
  description:
    "A low, rounded hump of blue-grey stone, broad enough to bask on.",
  radius: 0.46,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: () => buildBaked(domeModel, (color) => ({ color })),
};

export const quaterniusBlock: AssetDefinition = {
  kind: "quaternius-block",
  name: "Faceted block",
  group: "Stone",
  biomes: ["Tropical", "Temperate", "Desert"],
  description: "A squared-off block of blue-grey stone with a broken corner.",
  radius: 0.44,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: () => buildBaked(blockModel, (color) => ({ color })),
};

export const quaterniusLedge: AssetDefinition = {
  kind: "quaternius-ledge",
  name: "Faceted ledge",
  group: "Stone",
  biomes: ["Tropical", "Temperate", "Desert"],
  description:
    "A split slab of blue-grey stone that steps up to a flat top, a ready-made perch.",
  radius: 0.52,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: () => buildBaked(ledgeModel, (color) => ({ color })),
};
