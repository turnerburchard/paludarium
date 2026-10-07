import { describe, expect, it } from "vitest";
import { assets, livesIn } from "../src/assets";

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
