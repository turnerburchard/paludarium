import type * as THREE from "three";
import type { AssetKind } from "../model/schema";

export type Category = "Plants" | "Landscape" | "Animals";

/** How a frog species behaves in the simulation. */
export interface FrogBehavior {
  nocturnal: boolean;
  climbs: boolean;
  speed: number;
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
  /** Frogs prefer to rest and sleep near it. */
  shelter?: boolean;
  frog?: FrogBehavior;
  /** Builds a fresh model. The same seed always gives the same shape. */
  build(random: () => number): THREE.Group;
}
