import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import snagModel from "./snag.json";

export const snag: AssetDefinition = {
  kind: "snag",
  name: "Spruce snag",
  group: "Wood",
  biomes: ["Temperate"],
  description:
    "A broken length of weathered spruce, split at one end, with a dead limb still reaching up.",
  radius: 0.6,
  habitat: "either",
  hardscape: "wood",
  blocksMovement: true,
  build,
};

/** Model: "Log" by Poly by Google, CC-BY 3.0. */
function build(random: () => number) {
  // Sun and snow bleach spruce bark grey; the broken ends stay paler.
  const colors: Record<string, string> = {
    bark: "#55493f",
    barkLight: "#62564a",
    cut: "#7d6e5c",
  };
  const root = buildBaked(snagModel, (source) => ({ color: colors[source] }));
  root.scale.set(
    0.85 + random() * 0.3,
    0.9 + random() * 0.2,
    0.9 + random() * 0.2,
  );
  return root;
}
