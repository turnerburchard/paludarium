import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import orchidModel from "./orchid.json";

export const orchid: AssetDefinition = {
  kind: "orchid",
  name: "Reed-stem orchid",
  scientificName: "Epidendrum ibaguense",
  category: "Plants",
  description:
    "A tall, leafy cane topped with clusters of starry magenta flowers, common on cloud forest banks.",
  radius: 0.22,
  habitat: "land",
  soil: "drained",
  build,
};

/** Model: "Flowers" by CreativeTrio, CC0. */
function build() {
  return buildBaked(orchidModel, (source) => ({ color: `#${source}` }));
}
