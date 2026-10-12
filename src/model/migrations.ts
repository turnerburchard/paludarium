/** The version every world is saved at. */
export const WORLD_VERSION = 2;

type SavedWorld = Record<string, unknown>;

function isRecord(value: unknown): value is SavedWorld {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Each step takes a world saved at its index + 1 to the next version.
 * Saves and share links outlive the code that wrote them, so a step is never
 * edited or removed once it ships. */
const steps: ((world: SavedWorld) => SavedWorld)[] = [
  // Springs joined the environment. Older worlds have none.
  (world) => ({
    ...world,
    version: 2,
    environment: {
      springs: [],
      ...(isRecord(world.environment) ? world.environment : {}),
    },
  }),
];

/** Brings a saved world up to the current version. Anything it can't
 * recognize passes through for validation to reject. */
export function migrateWorld(data: unknown): unknown {
  if (!isRecord(data) || typeof data.version !== "number") return data;
  let world = data;
  for (let version = data.version; version < WORLD_VERSION; version++) {
    const step = steps[version - 1];
    if (!step) return data;
    world = step(world);
  }
  return world;
}
