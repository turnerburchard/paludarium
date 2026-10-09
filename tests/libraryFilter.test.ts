import { describe, expect, it } from "vitest";
import { assets, livesIn, prebuiltLivesIn } from "../src/assets";
import { prebuilts } from "../src/model/prebuilts";

describe("livesIn", () => {
  it("matches the biomes an asset lists", () => {
    expect(livesIn(assets["prickly-pear"], "Desert")).toBe(true);
    expect(livesIn(assets["prickly-pear"], "Tropical")).toBe(false);
  });

  it("counts anything that can live in water as underwater", () => {
    expect(livesIn(assets.pupfish, "Underwater")).toBe(true);
    expect(livesIn(assets["java-fern"], "Underwater")).toBe(true);
    expect(livesIn(assets.monstera, "Underwater")).toBe(false);
  });
});

describe("prebuiltLivesIn", () => {
  const namesIn = (place: Parameters<typeof prebuiltLivesIn>[1]) =>
    prebuilts
      .filter((prebuilt) => prebuiltLivesIn(prebuilt, place))
      .map((prebuilt) => prebuilt.name);

  it("matches the biomes a prebuilt lists", () => {
    expect(namesIn("Desert")).toEqual(["Desert ledge"]);
    expect(namesIn("Tropical")).toEqual([
      "Mossy shelter",
      "Slab cave",
      "Root tangle",
    ]);
  });

  it("counts a prebuilt as underwater only when every piece can live there", () => {
    expect(namesIn("Underwater")).toEqual([]);
  });
});
