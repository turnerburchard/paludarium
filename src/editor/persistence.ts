import { emptyWorld, worldSchema, type World } from "../model/schema";
import { fitObject } from "../model/terrain";
export const STORAGE_KEY = "little-worlds:v1";
export function parseWorld(text: string): World {
  if (text.length > 250_000)
    throw new Error("This file is too large for a terrarium.");
  const result = worldSchema.safeParse(JSON.parse(text));
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
    return { world: saved ? parseWorld(saved) : emptyWorld(), warning: null };
  } catch {
    return {
      world: emptyWorld(),
      warning:
        "Your saved world could not be opened. Export a backup after editing.",
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
