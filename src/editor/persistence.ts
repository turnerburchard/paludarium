import { createObjectId } from "../model/objectId";
import { z } from "zod";
import { makePreset } from "../model/presets";
import { emptyWorld, worldSchema, type World } from "../model/schema";
import { fitObject } from "../model/terrain";
export const STORAGE_KEY = "little-worlds:v1";
export const MAX_WORLD_SIZE = 250_000;
export function parseWorld(text: string): World {
  if (text.length > MAX_WORLD_SIZE)
    throw new Error("This file is too large for a terrarium.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a Paludarium terrarium.");
  }
  const result = worldSchema.safeParse(data);
  if (!result.success)
    throw new Error("This is not a supported Paludarium terrarium file.");
  return {
    ...result.data,
    objects: result.data.objects.map((o) =>
      fitObject(o, result.data.environment),
    ),
  };
}
const librarySchema = z
  .object({
    version: z.literal(1),
    activeId: z.string(),
    worlds: z.array(z.object({ id: z.string(), world: worldSchema })).min(1),
  })
  .superRefine((library, ctx) => {
    if (
      !library.worlds.some((entry) => entry.id === library.activeId) ||
      new Set(library.worlds.map((entry) => entry.id)).size !==
        library.worlds.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid world collection.",
      });
  });
export type WorldLibrary = z.infer<typeof librarySchema>;
export function createLibrary(world: World): WorldLibrary {
  const id = createObjectId();
  return { version: 1, activeId: id, worlds: [{ id, world }] };
}
export function parseLibrary(text: string): WorldLibrary {
  const data = JSON.parse(text);
  // Existing single-world saves become the first entry without changing the habitat.
  if (!data.worlds) return createLibrary(parseWorld(text));
  const library = librarySchema.parse(data);
  return {
    ...library,
    worlds: library.worlds.map((entry) => ({
      ...entry,
      world: {
        ...entry.world,
        objects: entry.world.objects.map((o) =>
          fitObject(o, entry.world.environment),
        ),
      },
    })),
  };
}
export function activeWorld(library: WorldLibrary): World {
  return library.worlds.find((entry) => entry.id === library.activeId)!.world;
}
export function updateLibrary(
  library: WorldLibrary,
  world: World,
): WorldLibrary {
  return {
    ...library,
    worlds: library.worlds.map((entry) =>
      entry.id === library.activeId ? { ...entry, world } : entry,
    ),
  };
}
export function loadLibrary(): {
  library: WorldLibrary;
  warning: string | null;
} {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return {
      library: saved
        ? parseLibrary(saved)
        : createLibrary(makePreset("aquarium")),
      warning: null,
    };
  } catch {
    return {
      library: createLibrary(emptyWorld()),
      warning:
        "Your saved worlds could not be opened. They stay saved until you edit or create a world.",
    };
  }
}
export function saveLibrary(library: WorldLibrary): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    return true;
  } catch {
    return false;
  }
}
export function downloadWorld(world: World) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(world, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${world.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "terrarium"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
