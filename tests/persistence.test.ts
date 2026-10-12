import { describe, expect, it, vi, afterEach } from "vitest";
import {
  activeEntry,
  createLibrary,
  loadLibrary,
  openLibraryWorld,
  parseLibrary,
  parseWorld,
  renameLibraryWorld,
  saveLibrary,
  worldFile,
} from "../src/editor/persistence";
import { makePreset } from "../src/model/presets";
import { MAX_WORLD_SIZE } from "../src/model/worldToken";
import {
  emptyWorld,
  LOG_LENGTH,
  MAX_OBJECTS,
  MAX_SPRINGS,
  MAX_TANK_DEPTH,
  MAX_TANK_WIDTH,
  type World,
} from "../src/model/schema";
import { terrainPointCount } from "../src/model/terrainData";
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
  it("keeps a preview's life on reload and keeps an edited one", () => {
    const library = createLibrary(makePreset("amazon"), true);
    const preview = activeEntry(library);
    const evolved = { ...preview.world, objects: [] };
    const watched = openLibraryWorld(library, { ...preview, world: evolved });
    const reloaded = parseLibrary(JSON.stringify(watched));
    expect(reloaded.worlds[0].preview).toBe(true);
    expect(activeEntry(reloaded).world).toEqual(evolved);
    const edited = openLibraryWorld(reloaded, {
      id: preview.id,
      world: { ...evolved, name: "My aquarium" },
    });
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
    expect(loaded.worlds).toHaveLength(1);
    expect(loaded.worlds[0].preview).toBe(true);
    expect(activeEntry(loaded).world.name).toBe("Cloud forest");
  });
  it("migrates an existing world without losing its layout or life", () => {
    const world = makePreset("tropical");
    const library = parseLibrary(JSON.stringify(world));
    expect(library.worlds).toHaveLength(1);
    expect(activeEntry(library).world).toEqual(world);
    expect(activeEntry(parseLibrary(JSON.stringify(library))).world).toEqual(
      world,
    );
  });
  it("saves one tab's world without undoing another tab's changes", () => {
    const kept = createLibrary(makePreset("tropical"));
    const first = activeEntry(kept);
    // Another tab opens a second world and renames the first.
    const elsewhere = renameLibraryWorld(
      openLibraryWorld(kept, { id: "second", world: makePreset("amazon") }),
      first.id,
      "Front shelf",
    );
    // This tab saves the second world over what the other tab left.
    const saved = openLibraryWorld(elsewhere, {
      id: "second",
      world: { ...makePreset("amazon"), name: "My aquarium" },
    });
    const reloaded = parseLibrary(JSON.stringify(saved));
    expect(reloaded.worlds.map((entry) => entry.world.name)).toEqual([
      "My aquarium",
      "Front shelf",
    ]);
  });
  it("renames a world that isn't open and keeps animal names", () => {
    const open = makePreset("amazon");
    const frog = { ...open.objects[0], name: "Pip" };
    const original = createLibrary({
      ...open,
      objects: open.objects.map((o) => (o.id === frog.id ? frog : o)),
    });
    const library = {
      ...original,
      worlds: [
        ...original.worlds,
        { id: "other", world: makePreset("tropical") },
      ],
    };
    const reloaded = parseLibrary(
      JSON.stringify(renameLibraryWorld(library, "other", "Back shelf")),
    );
    expect(reloaded.worlds[1].world.name).toBe("Back shelf");
    expect(activeEntry(reloaded).world.name).toBe(open.name);
    expect(
      activeEntry(reloaded).world.objects.find((o) => o.id === frog.id)?.name,
    ).toBe("Pip");
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
  it.each([
    ["an unreadable save", () => "broken"],
    [
      "blocked storage",
      () => {
        throw new Error("Access denied");
      },
    ],
  ])("opens the cloud forest instead of %s", (_, getItem) => {
    vi.stubGlobal("localStorage", {
      getItem,
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    });
    const loaded = loadLibrary();
    expect(loaded.worlds[0].preview).toBe(true);
    expect(activeEntry(loaded).world.name).toBe("Cloud forest");
    expect(saveLibrary(loaded)).toBe(false);
  });
  it("reads any height on a stack and any amount of turning", () => {
    const world = makePreset("tropical");
    const [first, ...rest] = world.objects;
    const turned = { ...first, rotation: 250, lift: 12 };
    expect(
      parseLibrary(
        JSON.stringify(createLibrary({ ...world, objects: [turned, ...rest] })),
      ).worlds[0].world.objects[0],
    ).toMatchObject({ rotation: 250, lift: 12 });
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

describe("world files", () => {
  // Every field at its longest, on the finest grid resizing keeps (points
  // 0.15 apart) with heights at the brush's four decimals.
  function largestWorld(): World {
    const columns = Math.floor(MAX_TANK_WIDTH / 0.15),
      rows = Math.floor(MAX_TANK_DEPTH / 0.15);
    const points = terrainPointCount({ columns, rows });
    const long = 1234.123456789012;
    const id = (i: number) => `${"x".repeat(36)}${i}`;
    return {
      ...emptyWorld(),
      name: "x".repeat(60),
      environment: {
        ...emptyWorld().environment,
        width: MAX_TANK_WIDTH,
        depth: MAX_TANK_DEPTH,
        height: 6,
        springs: Array(MAX_SPRINGS).fill({ x: -0.1234, z: 0.1234, flow: 0.1 }),
        terrain: {
          columns,
          rows,
          heights: Array(points).fill(-0.8765),
          paint: Array(points).fill("natural"),
        },
      },
      objects: Array.from({ length: MAX_OBJECTS }, (_, i) => ({
        id: id(i),
        kind: "stripe-tailed-scorpion",
        x: -11.123456789012345,
        z: -6.123456789012345,
        rotation: -12.123456789012345,
        scale: 1.1234567890123456,
        seed: 2147483647,
        life: { age: long, lifespan: long, condition: 0.123, breeding: long },
        support: id(i + 1),
        lift: 1.123456789012345,
        name: "x".repeat(40),
      })),
      log: Array(LOG_LENGTH).fill({
        at: 1760000000000.123,
        event: "died",
        kind: "stripe-tailed-scorpion",
        cause: "stranded",
      }),
    };
  }

  it("import the largest world the editor can make", async () => {
    const text = await worldFile(largestWorld()).text();
    expect(text.length).toBeLessThan(MAX_WORLD_SIZE);
    expect(() => parseWorld(text)).not.toThrow();
  });
});
