import { describe, expect, it } from "vitest";
import {
  createWorldLink,
  isWorldLink,
  readWorldLink,
} from "../src/editor/worldLinks";
import { MAX_WORLD_SIZE } from "../src/editor/persistence";
import { makePreset } from "../src/model/presets";
import { emptyWorld, MAX_OBJECTS } from "../src/model/schema";
import { TERRAIN_POINTS } from "../src/model/terrainData";

const baseURL = "https://turnerburchard.com/paludarium/";
async function untrustedLink(text: string) {
  const bytes = new Uint8Array(
    await new Response(
      new Blob([text]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  return `#world=1.${btoa(
    Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")}`;
}

describe("shared world snapshots", () => {
  it.each(["empty", "tropical", "mountain", "aquarium"] as const)(
    "round trips the %s layout in a URL-safe fragment",
    async (preset) => {
      const world = makePreset(preset);
      const link = new URL(await createWorldLink(world, baseURL));
      expect(link.origin + link.pathname).toBe(baseURL);
      expect(link.hash).toMatch(/^#world=1\.[A-Za-z0-9_-]+$/);
      expect(link.href.length).toBeLessThan(5000);
      expect(await readWorldLink(link.hash)).toEqual(world);
    },
  );
  it("keeps sculpted terrain, painted materials, rotations, seeds and unicode names", async () => {
    const world = makePreset("tropical");
    world.name = "Turner’s tiny forest 🐸";
    world.environment.terrain = {
      heights: Array.from(
        { length: TERRAIN_POINTS },
        (_, i) => Math.sin(i) * 0.1,
      ),
      paint: Array.from({ length: TERRAIN_POINTS }, (_, i) =>
        i % 3 ? "sand" : "soil",
      ),
    };
    world.objects = Array.from({ length: MAX_OBJECTS }, (_, i) => ({
      ...world.objects[0],
      id: `plant-${i}`,
      rotation: i / 30,
      seed: i,
    }));
    const link = await createWorldLink(world, baseURL);
    expect(await readWorldLink(new URL(link).hash)).toEqual(world);
    world.name = "An edited copy";
    expect((await readWorldLink(new URL(link).hash)).name).toBe(
      "Turner’s tiny forest 🐸",
    );
    expect(await createWorldLink(world, baseURL)).not.toBe(link);
  });
  it.each([
    "#world=",
    "#world=2.abc",
    "#world=1.abc!",
    "#world=1.a",
    "#world=1." + "x".repeat(80_001),
  ])("rejects incomplete, unsupported or corrupt links", async (hash) => {
    expect(isWorldLink(hash)).toBe(true);
    await expect(readWorldLink(hash)).rejects.toThrow();
  });
  it("validates the save schema after decompression", async () => {
    for (const text of [
      "not JSON",
      '{"version":99}',
      JSON.stringify({ ...emptyWorld(), name: "x".repeat(61) }),
    ])
      await expect(readWorldLink(await untrustedLink(text))).rejects.toThrow();
  });
  it("bounds decompressed input even when its compressed link is tiny", async () => {
    const bomb = await untrustedLink("x".repeat(MAX_WORLD_SIZE + 1));
    expect(bomb.length).toBeLessThan(1000);
    await expect(readWorldLink(bomb)).rejects.toThrow("too large");
  });
  it("ignores unrelated fragments", () => {
    expect(isWorldLink("#about")).toBe(false);
  });
});
