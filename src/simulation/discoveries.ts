import type { AnimalState } from "./types";

export type DiscoveryKind =
  | "hunt"
  | "leaf"
  | "glass"
  | "shelter"
  | "soak"
  | "sleep";
export interface Discovery {
  kind: DiscoveryKind;
  animalId: string;
  speciesId: string;
  elapsed: number;
}

/** Record arrivals and behavior, rather than promises made while choosing a route. */
export function discoveryFor(animal: AnimalState): DiscoveryKind | null {
  if (animal.activity === "eating" && !animal.moving) return "hunt";
  if (animal.activity === "bathing" && !animal.moving) return "soak";
  if (animal.surface === "glass" && animal.moving) return "glass";
  if (animal.moving) return null;
  if (animal.nodeId.startsWith("den:")) return "shelter";
  if (animal.surface === "leaf") return "leaf";
  if (animal.activity === "sleeping") return "sleep";
  return null;
}
