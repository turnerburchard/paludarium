import type * as THREE from "three";
import type { Soil } from "../model/plants";
import type { AssetKind } from "../model/schema";
import type { Den, PlantPerch } from "../model/plantSurfaces";
import type { Surface } from "../simulation/types";

export type Category = "Plants" | "Landscape" | "Animals";

/** How a land animal behaves in the simulation. */
export interface AnimalBehavior {
  nocturnal: boolean;
  climbs: boolean;
  speed: number;
  /** Hoppers hop every edge, climbers hop on the ground and leap between
   * leaves, crawlers and scurriers walk. Scurriers dash and pause. */
  movement?: "hop" | "climb" | "crawl" | "scurry";
  maxPerchHeight?: number;
  /** Surfaces it likes to rest on, beyond plain shelter. Frogs favor leaves. */
  restsOn?: Surface[];
  /** Feeds on algae and film wherever it goes, so it never goes hungry and
   * leaves the insects to others. */
  grazes?: boolean;
}

/** Everything the app knows about one kind of placeable thing. */
export interface AssetDefinition {
  kind: AssetKind;
  name: string;
  scientificName?: string;
  category: Category;
  description: string;
  /** Footprint at scale 1, used for placement bounds and selection rings. */
  radius: number;
  habitat: "land" | "water" | "either";
  /** Frogs route around it. */
  blocksMovement?: boolean;
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
  /** How a fish swims: cruising speed, and how far below the surface it keeps. */
  swims?: { speed: number; depth: number };
  /** Sheltered spots inside the object, such as under a rock overhang. */
  dens?(random: () => number): Den[];
  /** Builds a fresh model. The same seed always gives the same shape. */
  build(random: () => number): THREE.Group;
}
