import { createObjectId } from "../model/objectId";
import { z } from "zod";
import { makePreset } from "../model/presets";
import { worldSchema, type World } from "../model/schema";
import { fitObject } from "../model/terrain";
import { MAX_WORLD_SIZE } from "../model/worldToken";
export const STORAGE_KEY = "little-worlds:v4";
/** Worlds saved before springs joined the environment. They are not
 * migrated, only cleared. */
const RETIRED_STORAGE_KEY = "little-worlds:v3";
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
export function activeEntry(library: WorldLibrary) {
  return library.worlds.find((entry) => entry.id === library.activeId)!;
}
export function renameLibraryWorld(
  library: WorldLibrary,
  id: string,
  name: string,
): WorldLibrary {
  return {
    ...library,
    worlds: library.worlds.map((entry) =>
      entry.id === id ? { ...entry, world: { ...entry.world, name } } : entry,
    ),
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
/** The saved worlds, or a first visit's cloud forest when there are none
 * or they can't be read. */
export function loadLibrary(): WorldLibrary {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return parseLibrary(saved);
  } catch {
    // Blocked storage or a save this version can't read.
  }
  return createLibrary(makePreset("tropical"), true);
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
export function worldFile(world: World) {
  return new File(
    [JSON.stringify(world)],
    `${world.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "terrarium"}.json`,
    { type: "application/json" },
  );
}
export function downloadWorld(world: World) {
  const file = worldFile(world);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
