import { describe, expect, it } from "vitest";
import { prebuiltObjects, prebuilts } from "../src/model/prebuilts";
import { makePreset } from "../src/model/presets";
import { emptyWorld } from "../src/model/schema";
import { objectBase } from "../src/model/stacking";

const env = emptyWorld().environment;
const shelter = prebuilts.find((p) => p.id === "rock-shelter")!;

describe("prebuilts", () => {
  it("rests each stacked piece its height above the piece it sits on", () => {
    for (const prebuilt of prebuilts) {
      const objects = prebuiltObjects(prebuilt, 1, 0.5, 0, env);
      prebuilt.pieces.forEach((piece, i) => {
        if (piece.on === undefined)
          return expect(objects[i].support).toBe(undefined);
        const support = objects[piece.on];
        expect(objects[i].support).toBe(support.id);
        expect(objectBase(objects[i], env)).toBeCloseTo(
          objectBase(support, env) + piece.height!,
        );
      });
    }
  });
  it("turns the whole arrangement about its center", () => {
    const [stone] = prebuiltObjects(shelter, 0, 0, Math.PI / 2, env);
    // The left stone swings to the front, as a model turned by Three.js.
    expect(stone.x).toBeCloseTo(0);
    expect(stone.z).toBeCloseTo(0.44);
    expect(stone.rotation).toBeCloseTo(Math.PI / 2 + 0.3);
  });
  it("builds preset shelters from separate stones, with moss on the capstone", () => {
    const capstones = makePreset("grotto").objects.filter(
      (o) => o.kind === "capstone",
    );
    expect(capstones).toHaveLength(2);
    expect(capstones.every((o) => o.support && o.moss)).toBe(true);
  });
});
