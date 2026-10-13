import type * as THREE from "three";
import type { Soil } from "../model/plants";
import type { AssetKind } from "../model/schema";
import type { Den, PlantPerch } from "../model/plantSurfaces";
import type { Surface } from "../simulation/types";

export type Category = "Plants" | "Hardscape" | "Animals";

/** Where in the world a thing comes from. Whether it lives underwater is its
 * habitat, not a biome. */
export type Biome = "Tropical" | "Temperate" | "Desert";

/** Finer groups within each category, for filtering the library. Adding a
 * group means listing it here and moving its assets into it. */
export const groupCategories = {
  "Leafy plants": "Plants",
  Grasses: "Plants",
  "Cacti & succulents": "Plants",
  "Aquatic plants": "Plants",
  Mosses: "Plants",
  Mushrooms: "Plants",
  Stone: "Hardscape",
  Wood: "Hardscape",
  Prebuilt: "Hardscape",
  Amphibians: "Animals",
  Reptiles: "Animals",
  Fish: "Animals",
  Invertebrates: "Animals",
} as const satisfies Record<string, Category>;

export type Group = keyof typeof groupCategories;

/** How a land animal behaves in the simulation. */
export interface AnimalBehavior {
  nocturnal: boolean;
  climbs: boolean;
  speed: number;
  /** Hoppers and climbers hop ground stretches and leap between leaves.
   * Short mesh contacts are walked; scurriers dash and pause. */
  movement?: "hop" | "climb" | "crawl" | "scurry";
  maxPerchHeight?: number;
  /** Surfaces it likes to rest on, beyond plain shelter. Frogs favor leaves. */
  restsOn?: Surface[];
  /** Feeds on algae and film wherever it goes, so it never goes hungry and
   * leaves the insects to others. */
  grazes?: boolean;
  /** Whether it walks underwater: animals that visit still need dry land,
   * and those that live there never leave it or dry out. */
  water?: "visits" | "lives";
}

/** How a fish swims. Speed is in scene units per real second at normal
 * simulation speed. Depth is the range below the surface it keeps to, as in
 * water 0.4 deep: deeper water stretches it, so schools spread through a deep
 * tank. Anything past 0.4 reaches the bottom. */
export interface Swimming {
  speed: number;
  depth: readonly [number, number];
}

/** Everything the app knows about one kind of placeable thing. */
export interface AssetDefinition {
  kind: AssetKind;
  name: string;
  scientificName?: string;
  group: Group;
  biomes: readonly [Biome, ...Biome[]];
  description: string;
  /** Footprint of the model as built, used for placement bounds and
   * selection rings. */
  radius: number;
  /** Brings the model to the shared world scale, about 10 cm a unit, without
   * reworking its geometry. Scales the model, footprint, perches and dens. */
  size?: number;
  /** New placements pick a scale in this range, so plants vary like real
   * ones of different ages. */
  scaleRange?: readonly [number, number];
  habitat: "land" | "water" | "either";
  /** Where a long piece meets the ground, in model units. It settles to the
   * lowest ground under these, so on a slope no end hangs in the air. Other
   * stone and wood settles to the lowest ground around its footprint. */
  groundPoints?: readonly { x: number; z: number }[];
  /** The whole model is solid, rather than just its structural parts. */
  blocksMovement?: boolean;
  /** Firm living surfaces, such as moss cushions and mushroom caps. This
   * changes animal contact, not placement or the asset's category. */
  supportsAnimals?: boolean;
  /** Low, yielding cover is walked over rather than closing ground routes. */
  groundCover?: boolean;
  /** Structural parts only, built from the same geometry as the visible
   * model. Leaves remain passable. Coordinates precede size calibration. */
  buildStructure?(random: () => number): THREE.Group;
  /** Visual bend and sway, from stationary (0) to flexible foliage (1). */
  flexibility?: number;
  /** Frogs prefer to rest and sleep near it, and insects breed under it. */
  shelter?: boolean;
  /** Plants grow well only in the soil they like. */
  soil?: Soil;
  /** Rests on the water's surface, like a lily pad, instead of the bottom. */
  floats?: boolean;
  /** Stone or wood: moss can grow over it, other things can rest on it, and
   * animals walk it as that surface. */
  hardscape?: "stone" | "wood";
  behavior?: AnimalBehavior;
  perches?(random: () => number): PlantPerch[];
  swims?: Swimming;
  /** Sheltered spots inside the object, such as under a rock overhang. */
  dens?(random: () => number): Den[];
  /** Builds a fresh model. The same seed always gives the same shape. */
  build(random: () => number): THREE.Group;
}
