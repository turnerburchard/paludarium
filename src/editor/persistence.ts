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
export function loadWorld(): { world: World; warning: string | null } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // First visit opens on a finished habitat rather than an empty tank.
    return {
      world: saved ? parseWorld(saved) : makePreset("aquarium"),
      warning: null,
    };
  } catch {
    return {
      world: emptyWorld(),
      warning:
        "Your saved world could not be opened. It stays saved until you edit this one.",
    };
  }
}
export function saveWorld(world: World): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(world));
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
