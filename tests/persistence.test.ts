import { describe, expect, it, vi, afterEach } from "vitest";
import {
  activeWorld,
  createLibrary,
  loadLibrary,
  parseLibrary,
  saveLibrary,
  STORAGE_KEY,
  updateLibrary,
} from "../src/editor/persistence";
import { makePreset } from "../src/model/presets";
import { historyReducer } from "../src/editor/history";

afterEach(() => vi.unstubAllGlobals());

describe("saved world collection", () => {
  it("migrates an existing world without losing its layout or life", () => {
    const world = makePreset("tropical");
    const library = parseLibrary(JSON.stringify(world));
    expect(library.worlds).toHaveLength(1);
    expect(activeWorld(library)).toEqual(world);
    expect(activeWorld(parseLibrary(JSON.stringify(library)))).toEqual(world);
  });
  it("updates only the active world and preserves the others", () => {
    const first = makePreset("tropical");
    const second = makePreset("aquarium");
    const original = createLibrary(first);
    const library = {
      ...original,
      activeId: "second",
      worlds: [...original.worlds, { id: "second", world: second }],
    };
    const updated = updateLibrary(library, { ...second, name: "My aquarium" });
    expect(updated.worlds[0].world).toEqual(first);
    expect(activeWorld(parseLibrary(JSON.stringify(updated))).name).toBe(
      "My aquarium",
    );
  });
  it("rejects an invalid active id, duplicate ids, and invalid worlds", () => {
    const library = createLibrary(makePreset("empty"));
    expect(() =>
      parseLibrary(JSON.stringify({ ...library, activeId: "missing" })),
    ).toThrow();
    expect(() =>
      parseLibrary(
        JSON.stringify({
          ...library,
          worlds: [...library.worlds, ...library.worlds],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseLibrary(
        JSON.stringify({
          ...library,
          worlds: [{ ...library.worlds[0], world: {} }],
        }),
      ),
    ).toThrow();
  });
  it("leaves unreadable storage untouched and reports failed saves", () => {
    const storage = {
      getItem: vi.fn(() => "broken"),
      setItem: vi.fn(() => {
        throw new Error("Quota exceeded");
      }),
    };
    vi.stubGlobal("localStorage", storage);
    const loaded = loadLibrary();
    expect(loaded.warning).toBeTruthy();
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(saveLibrary(loaded.library)).toBe(false);
  });
  it("clears undo history when opening another world", () => {
    const first = makePreset("tropical");
    const second = makePreset("aquarium");
    const history = historyReducer(
      { past: [first], present: second, future: [first] },
      { type: "open", world: first },
    );
    expect(history).toEqual({ past: [], present: first, future: [] });
    expect(historyReducer(history, { type: "undo" }).present).toBe(first);
  });
});
