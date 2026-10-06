import { describe, expect, it } from "vitest";
import { plantCondition } from "../src/model/plants";
import { makePreset } from "../src/model/presets";
import { defaultEnvironment, type HabitatObject } from "../src/model/schema";
import { groundHeight } from "../src/model/terrain";
import { buildHabitat, insectColonies } from "../src/simulation/worldHabitat";

const env = defaultEnvironment;
/** The bank is tallest toward the front of the tank. */
const Z = 1.5;
const plant = (kind: HabitatObject["kind"], x: number, z = Z) => ({
  id: kind,
  kind,
  x,
  z,
  rotation: 0,
  scale: 1,
  seed: 1,
});
/** Walks along the bank from the waterline up to find spots at given heights. */
function spotAt(height: number) {
  for (let x = 3; x > -3.5; x -= 0.01)
    if (groundHeight(x, Z, env) - env.water >= height) return x;
  throw new Error(`No ground ${height} above the water`);
}

describe("plant conditions", () => {
  it("has every preset plant thriving", () => {
    for (const preset of ["tropical", "mountain"] as const) {
      const world = makePreset(preset);
      for (const object of world.objects)
        expect(
          plantCondition(object, world.environment)?.thriving ?? true,
        ).toBe(true);
    }
  });

  it("ignores things that aren't plants", () => {
    expect(plantCondition(plant("rock", 0), env)).toBeNull();
    expect(plantCondition(plant("tree-frog", 0), env)).toBeNull();
  });

  it("puts sedge at the shore and strawberries up the bank", () => {
    const shore = spotAt(0.05),
      bank = spotAt(0.35);
    expect(plantCondition(plant("grass", shore), env)!.thriving).toBe(true);
    expect(plantCondition(plant("grass", bank), env)!.note).toMatch(/Too dry/);
    expect(plantCondition(plant("strawberry", shore), env)!.note).toMatch(
      /Too wet/,
    );
    expect(plantCondition(plant("strawberry", bank), env)!.thriving).toBe(true);
  });

  it("dries out damp-loving plants when the pond is drained", () => {
    const world = makePreset("tropical");
    const drained = { ...world.environment, water: 0 };
    const ferns = world.objects.filter((o) => o.kind === "fern");
    expect(ferns.some((f) => !plantCondition(f, drained)!.thriving)).toBe(true);
  });

  it("gives insects less to breed under when plants struggle", () => {
    const world = makePreset("tropical");
    const capacity = (w: typeof world) =>
      insectColonies(buildHabitat(w)).reduce((sum, c) => sum + c.capacity, 0);
    const drained = {
      ...world,
      environment: { ...world.environment, water: 0 },
    };
    expect(capacity(drained)).toBeLessThan(capacity(world));
  });
});
