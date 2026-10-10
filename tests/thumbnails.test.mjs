import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { catalog } from "../src/assets";
import { prebuilts } from "../src/model/prebuilts";
import { thumbnails } from "../src/scene/thumbnails";

it("has a generated PNG for every library entry", () => {
  const keys = [
    ...catalog.map((asset) => asset.kind),
    ...prebuilts.map((prebuilt) => `prebuilt:${prebuilt.id}`),
  ];
  expect(Object.keys(thumbnails).sort()).toEqual(keys.sort());
  for (const key of keys) {
    const image = readFileSync(
      new URL(`../public/${thumbnails[key]}`, import.meta.url),
    );
    expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(image.readUInt32BE(16)).toBe(160);
    expect(image.readUInt32BE(20)).toBe(130);
  }
});
