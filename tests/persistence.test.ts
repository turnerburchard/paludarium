import { describe, expect, it, vi, afterEach } from "vitest";
import {
  activeWorld,
  createLibrary,
  loadLibrary,
  openLibraryWorld,
  parseLibrary,
  saveLibrary,
  STORAGE_KEY,
  updateLibrary,
} from "../src/editor/persistence";
import { makePreset } from "../src/model/presets";
import { historyReducer } from "../src/editor/history";

afterEach(() => vi.unstubAllGlobals());

describe("saved world collection", () => {
  it("replaces the browsing preset 100 times without accumulating saves", () => {
    const saved = createLibrary(makePreset("empty"));
    let library = saved;
    for (let i = 0; i < 100; i++)
      library = openLibraryWorld(library, {
        id: `preset-${i}`,
        world: makePreset(i % 2 ? "amazon" : "tropical"),
        preview: true,
      });
    expect(library.worlds).toHaveLength(2);
    expect(library.worlds[0].id).toBe("preset-99");
    expect(library.worlds[1]).toEqual(saved.worlds[0]);
    library = openLibraryWorld(library, saved.worlds[0]);
    expect(library.worlds).toEqual(saved.worlds);
  });
  it("keeps a preview's life on reload and only promotes a manual edit", () => {
    const library = createLibrary(makePreset("amazon"), true);
    const evolved = { ...activeWorld(library), objects: [] };
    const watched = updateLibrary(library, evolved);
    const reloaded = parseLibrary(JSON.stringify(watched));
    expect(reloaded.worlds[0].preview).toBe(true);
    expect(activeWorld(reloaded)).toEqual(evolved);
    const edited = updateLibrary(
      reloaded,
      { ...evolved, name: "My aquarium" },
      true,
    );
    expect(edited.worlds[0].preview).toBeUndefined();
    const next = openLibraryWorld(edited, {
      id: "new-preset",
      world: makePreset("amazon"),
      preview: true,
    });
    expect(next.worlds).toHaveLength(2);
    expect(next.worlds[1].world.name).toBe("My aquarium");
    expect(next.worlds[0].world.objects.length).toBeGreaterThan(0);
  });
  it("puts recently opened worlds first without losing any saves", () => {
    let library = createLibrary(makePreset("empty"));
    const first = library.worlds[0];
    const second = { id: "second", world: makePreset("amazon") };
    library = openLibraryWorld(library, second);
    expect(library.worlds.map((entry) => entry.id)).toEqual([
      second.id,
      first.id,
    ]);
    library = openLibraryWorld(library, first);
    expect(library.worlds.map((entry) => entry.id)).toEqual([
      first.id,
      second.id,
    ]);
  });
  it("starts a first-time visitor on a resumable preset", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    const loaded = loadLibrary();
    expect(loaded.library.worlds).toHaveLength(1);
    expect(loaded.library.worlds[0].preview).toBe(true);
    expect(activeWorld(loaded.library).name).toBe("Amazon river");
  });
  it("migrates an existing world without losing its layout or life", () => {
    const world = makePreset("tropical");
    const library = parseLibrary(JSON.stringify(world));
    expect(library.worlds).toHaveLength(1);
    expect(activeWorld(library)).toEqual(world);
    expect(activeWorld(parseLibrary(JSON.stringify(library)))).toEqual(world);
  });
  it("updates only the active world and preserves the others", () => {
    const first = makePreset("tropical");
    const second = makePreset("amazon");
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
    expect(() =>
      parseLibrary(
        JSON.stringify({
          ...library,
          worlds: [
            ...library.worlds,
            {
              id: "inactive-preview",
              world: makePreset("empty"),
              preview: true,
            },
          ],
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
    const second = makePreset("amazon");
    const history = historyReducer(
      { past: [first], present: second, future: [first] },
      { type: "open", world: first },
    );
    expect(history).toEqual({ past: [], present: first, future: [] });
    expect(historyReducer(history, { type: "undo" }).present).toBe(first);
  });
});
