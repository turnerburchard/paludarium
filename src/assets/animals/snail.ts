import { buildBaked } from "../baked";
import type { AssetDefinition } from "../types";
import snailModel from "./snail.json";

export const snail: AssetDefinition = {
  kind: "snail",
  name: "Garden snail",
  scientificName: "Cornu aspersum",
  group: "Invertebrates",
  biomes: ["Tropical", "Temperate"],
  description:
    "A slow grazer that wanders the glass and leaves at night, cleaning as it goes.",
  radius: 0.16,
  habitat: "land",
  behavior: {
    nocturnal: true,
    climbs: true,
    speed: 0.012,
    movement: "crawl",
    restsOn: ["glass", "stem", "leaf"],
    grazes: true,
  },
  build,
};

/** The source model's palette: a pale foot, a darker head and stalks, and a
 * two-tone shell. */
const SHELL = "7e5426",
  SHELL_BAND = "9a794e";

/** Model: "Snail" by Poly by Google, CC-BY 3.0. The shell and body are
 * separate parts so the rig can stretch the body under the shell. */
function build() {
  return buildBaked(snailModel, (source) => {
    if (source === SHELL) return { color: "#6b4a2c", name: "shell" };
    if (source === SHELL_BAND) return { color: "#a1825a", name: "shell" };
    return { color: source === "d0b586" ? "#b8a07a" : "#c9b48f", name: "body" };
  });
}
