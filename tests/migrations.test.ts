import { describe, expect, it } from "vitest";
import { parseLibrary, parseWorld } from "../src/editor/persistence";
import { WORLD_VERSION } from "../src/model/migrations";
import { makePreset } from "../src/model/presets";

/** A world as version 1 saved it, before springs joined the environment. */
function versionOneWorld() {
  const { springs: _springs, ...environment } =
    makePreset("tropical").environment;
  return { ...makePreset("tropical"), version: 1, environment };
}

describe("saved world migrations", () => {
  it("opens a version 1 world with no springs", () => {
    const world = parseWorld(JSON.stringify(versionOneWorld()));
    expect(world.version).toBe(WORLD_VERSION);
    expect(world.environment.springs).toEqual([]);
  });
  it("keeps a version 1 world's own springs", () => {
    const spring = { x: 0.1, z: -0.2, flow: 0.5 };
    const old = versionOneWorld();
    const world = parseWorld(
      JSON.stringify({
        ...old,
        environment: { ...old.environment, springs: [spring] },
      }),
    );
    expect(world.environment.springs).toEqual([spring]);
  });
  it("opens version 1 worlds kept in a saved collection", () => {
    const library = parseLibrary(
      JSON.stringify({
        version: 1,
        activeId: "a",
        worlds: [{ id: "a", world: versionOneWorld() }],
      }),
    );
    expect(library.worlds[0].world.version).toBe(WORLD_VERSION);
  });
});
