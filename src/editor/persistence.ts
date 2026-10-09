import { createObjectId } from "../model/objectId";
import { z } from "zod";
import { makePreset } from "../model/presets";
import { emptyWorld, worldSchema, type World } from "../model/schema";
import { fitObject } from "../model/terrain";
export const STORAGE_KEY = "little-worlds:v4";
/** Worlds saved before streams joined the environment. They are not
 * migrated, only cleared. */
const RETIRED_STORAGE_KEY = "little-worlds:v3";
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
    worlds: z
      .array(
        z.object({
          id: z.string(),
          world: worldSchema,
          preview: z.literal(true).optional(),
        }),
      )
      .min(1),
  })
  .superRefine((library, ctx) => {
    if (
      !library.worlds.some((entry) => entry.id === library.activeId) ||
      library.worlds.some(
        (entry) => entry.preview && entry.id !== library.activeId,
      ) ||
      new Set(library.worlds.map((entry) => entry.id)).size !==
        library.worlds.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid world collection.",
      });
  });
export type WorldLibrary = z.infer<typeof librarySchema>;
export function createLibrary(world: World, preview = false): WorldLibrary {
  const id = createObjectId();
  return {
    version: 1,
    activeId: id,
    worlds: [{ id, world, ...(preview && { preview: true }) }],
  };
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
  edited = false,
): WorldLibrary {
  return {
    ...library,
    worlds: library.worlds.map((entry) => {
      if (entry.id !== library.activeId) return entry;
      if (edited) return { id: entry.id, world };
      return { ...entry, world };
    }),
  };
}
export function openLibraryWorld(
  library: WorldLibrary,
  entry: WorldLibrary["worlds"][number],
): WorldLibrary {
  return {
    ...library,
    activeId: entry.id,
    // Only the open preset is resumable. Kept worlds survive browsing.
    worlds: [
      entry,
      ...library.worlds.filter(
        (other) => !other.preview && other.id !== entry.id,
      ),
    ],
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
        : createLibrary(makePreset("aquarium"), true),
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
    localStorage.removeItem(RETIRED_STORAGE_KEY);
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
