import type { AssetDefinition } from "../types";
import { stemBunch } from "./rotala";

export const ludwigia: AssetDefinition = {
  kind: "ludwigia",
  name: "Red ludwigia",
  scientificName: "Ludwigia repens",
  category: "Plants",
  description:
    "Sturdy stems of broad, glossy leaves, olive below and deep coppery red toward the light.",
  radius: 0.24,
  habitat: "water",
  build: (random) =>
    stemBunch(random, {
      stems: 6,
      pairs: 6,
      leaf: 0.12,
      green: "#6b7f37",
      tip: "#a8392f",
      blush: 0.25,
    }),
};
