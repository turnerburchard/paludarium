import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import fungusLogModel from "./fungusLog.json";

export const fungusLog: AssetDefinition = {
  kind: "fungus-log",
  name: "Fungus log",
  group: "Wood",
  biomes: ["Tropical", "Temperate"],
  description:
    "A solid fallen log, slowly rotting, with shelf fungus stepping up its side. Insects breed beneath it.",
  radius: 0.58,
  habitat: "either",
  hardscape: "wood",
  blocksMovement: true,
  shelter: true,
  build,
};

/** Model: "log with fungus" by sirkitree, CC-BY 3.0. */
function build(random: () => number) {
  const colors: Record<string, string> = {
    "795545": "#5e4a39",
    "191919": "#2a2018",
    df9b45: "#c4935a",
  };
  const root = buildBaked(fungusLogModel, (source) => ({
    color: colors[source],
  }));
  // Each log is a little longer or stouter than the last.
  root.scale.set(
    0.9 + random() * 0.2,
    0.9 + random() * 0.2,
    0.85 + random() * 0.3,
  );
  return root;
}
