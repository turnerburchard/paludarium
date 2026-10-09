import { describe, expect, it } from "vitest";
import {
  prebuiltObjects,
  prebuiltProblem,
  prebuilts,
  rockShelter,
} from "../src/model/prebuilts";
import { makePreset } from "../src/model/presets";
import { AQUARIUM_WATER, emptyWorld } from "../src/model/schema";
import { objectBase } from "../src/model/stacking";

const env = emptyWorld().environment;

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
    const [stone] = prebuiltObjects(rockShelter, 0, 0, Math.PI / 2, env);
    // The left stone swings to the front, as a model turned by Three.js.
    expect(stone.x).toBeCloseTo(0);
    expect(stone.z).toBeCloseTo(0.44);
    expect(stone.rotation).toBeCloseTo(Math.PI / 2 + 0.3);
  });
  it("refuses a spot where a land plant would end up in water", () => {
    const shelter = prebuilts.find((p) => p.id === "mossy-shelter")!;
    const flooded = { ...env, water: AQUARIUM_WATER };
    expect(prebuiltProblem(prebuiltObjects(shelter, 0, 0, 0, env), env)).toBe(
      null,
    );
    expect(
      prebuiltProblem(prebuiltObjects(shelter, 0, 0, 0, flooded), flooded),
    ).toBe("Find a dry spot on the bank.");
  });
  it("builds preset shelters from separate stones, with moss on the capstone", () => {
    // The grotto also has a loose capstone lying on the ground.
    const capstones = makePreset("grotto").objects.filter(
      (o) => o.kind === "capstone" && o.support,
    );
    expect(capstones).toHaveLength(2);
    expect(capstones.every((o) => o.moss)).toBe(true);
  });
});
