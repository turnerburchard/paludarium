import type { FrogKind } from "../model/species";
import type { SpeciesProfile } from "./types";

/** Behavior categories have natural-history sources in docs/ECOSYSTEM.md.
 * Rates and speeds are deliberately accelerated game tuning, not husbandry advice. */
export const frogProfiles: Record<FrogKind, SpeciesProfile> = {
  "tree-frog": { id: "tree-frog", nocturnal: true, climbs: true, speed: 0.045 },
  "dart-frog": {
    id: "dart-frog",
    nocturnal: false,
    climbs: false,
    speed: 0.04,
  },
  "blue-dart-frog": {
    id: "blue-dart-frog",
    nocturnal: false,
    climbs: false,
    speed: 0.035,
  },
  "mossy-frog": {
    id: "mossy-frog",
    nocturnal: true,
    climbs: true,
    speed: 0.025,
  },
};
