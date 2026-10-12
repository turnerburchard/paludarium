import { assets, categoryOf, isAnimal } from "../assets";
import {
  animalLife,
  BREEDING_INTERVAL,
  MATURITY_AGE,
  newLifespan,
} from "../model/life";
import { plantCondition } from "../model/plants";
import { placementProblem } from "../model/water";
import {
  LOG_LENGTH,
  MAX_OBJECTS,
  type HabitatObject,
  type LogEntry,
  type World,
} from "../model/schema";

// Game-tuning values in active real seconds, not biological measurements.
const PLANTS_PER_ANIMAL = 1;
const SPACE_PER_ANIMAL = 1;
// A bare tank starves its animals within a minute; a slight shortfall takes
// proportionally longer.
const SHORTAGE_TOLERANCE = 60;
const RECOVERY_TIME = 10 * 60;
/** How long an animal lasts with nowhere it can live, such as a frog in a
 * flooded tank or a fish in a drained one. */
const STRANDED_TOLERANCE = 3 * 60;

/** Animals keep where they have wandered to, so a reload doesn't send them
 * back to where they were placed. Rounded to the millimetre to keep saves
 * small. */
export function withAnimalPositions(
  world: World,
  positionOf: (id: string) => { x: number; z: number } | undefined,
): World {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const objects = world.objects.map((object) => {
    const position = isAnimal(object.kind) && positionOf(object.id);
    if (!position) return object;
    const x = round(position.x),
      z = round(position.z);
    return x === object.x && z === object.z ? object : { ...object, x, z };
  });
  return objects.every((object, i) => object === world.objects[i])
    ? world
    : { ...world, objects };
}

/** A deliberate death uses the same population and log as natural deaths. */
export function killAnimal(world: World, id: string, now = Date.now()): World {
  const object = world.objects.find((o) => o.id === id);
  if (!object || !isAnimal(object.kind)) return world;
  const death: LogEntry = {
    at: now,
    event: "died",
    kind: object.kind,
    cause: "killed",
  };
  return {
    ...world,
    objects: world.objects.filter((o) => o.id !== id),
    log: [...(world.log ?? []), death].slice(-LOG_LENGTH),
  };
}

export function habitatSupport(world: World) {
  const population = world.objects.filter((o) => isAnimal(o.kind)).length;
  const plants = world.objects.filter((o) => {
    const asset = assets[o.kind];
    const planted =
      categoryOf(asset) === "Plants" ||
      asset.soil !== undefined ||
      o.kind === "java-moss";
    return (
      planted &&
      plantCondition(o, world.environment)?.thriving !== false &&
      !placementProblem(o.kind, o.x, o.z, world.environment, o.lift ?? 0)
    );
  }).length;
  const foodCapacity = plants / PLANTS_PER_ANIMAL;
  const spaceCapacity =
    (world.environment.width * world.environment.depth) / SPACE_PER_ANIMAL;
  return {
    population,
    plants,
    capacity: Math.min(foodCapacity, spaceCapacity),
    food: population ? Math.min(1, foodCapacity / population) : 1,
    space: population ? Math.min(1, spaceCapacity / population) : 1,
  };
}

/** `stranded` lists the animals with nowhere they can live. Deaths are
 * logged at `now`. */
export function advanceLife(
  world: World,
  seconds: number,
  stranded: ReadonlySet<string> = new Set(),
  now = Date.now(),
): World {
  if (seconds === 0 || !world.objects.some((o) => isAnimal(o.kind)))
    return world;
  const habitat = habitatSupport(world);
  const support = Math.min(habitat.food, habitat.space);
  const log: LogEntry[] = [];
  const objects = world.objects.flatMap((object) => {
    if (!isAnimal(object.kind)) return [object];
    const previous = animalLife(object);
    const homeless = stranded.has(object.id);
    let change = 1 / RECOVERY_TIME;
    if (homeless) change = -1 / STRANDED_TOLERANCE;
    else if (support < 1) change = -(1 - support) / SHORTAGE_TOLERANCE;
    const condition = Math.max(
      0,
      Math.min(1, previous.condition + seconds * change),
    );
    const life = {
      ...previous,
      age: previous.age + seconds,
      condition,
      breeding:
        condition >= 0.6 && support >= 1 && !homeless
          ? Math.min(BREEDING_INTERVAL, previous.breeding + seconds)
          : 0,
    };
    if (life.age >= life.lifespan || life.condition <= 0) {
      log.push({
        at: now,
        event: "died",
        kind: object.kind,
        cause: causeOfDeath(object, life, homeless, habitat),
      });
      return [];
    }
    return [{ ...object, life }];
  });

  if (!log.length) return { ...world, objects };
  return {
    ...world,
    objects,
    log: [...(world.log ?? []), ...log].slice(-LOG_LENGTH),
  };
}

/** Mature animals that have been well long enough to breed, while the
 * habitat has food and space for one more. */
export function readyToBreed(world: World): Set<string> {
  const habitat = habitatSupport(world);
  if (
    habitat.population + 1 > Math.floor(habitat.capacity) ||
    world.objects.length >= MAX_OBJECTS
  )
    return new Set();
  return new Set(
    world.objects
      .filter((object) => {
        if (!isAnimal(object.kind)) return false;
        const life = animalLife(object);
        return life.age >= MATURITY_AGE && life.breeding >= BREEDING_INTERVAL;
      })
      .map((object) => object.id),
  );
}

/** Each pair that met while courting has a juvenile between them, so long
 * as both are still ready and there is room for it. Births are logged at
 * `now`. */
export function breed(
  world: World,
  meetings: readonly (readonly [string, string])[],
  random = Math.random,
  now = Date.now(),
): World {
  let objects = world.objects;
  const log: LogEntry[] = [];
  for (const [a, b] of meetings) {
    const current = { ...world, objects };
    const ready = readyToBreed(current);
    const first = objects.find((o) => o.id === a);
    const second = objects.find((o) => o.id === b);
    if (
      !first ||
      !second ||
      first.kind !== second.kind ||
      !ready.has(a) ||
      !ready.has(b)
    )
      continue;
    const seed = Math.floor(random() * 2147483647);
    const birthId = `born:${seed}:${Math.floor(animalLife(first).age)}`;
    let serial = 0;
    let id = birthId;
    while (objects.some((o) => o.id === id)) id = `${birthId}:${++serial}`;
    const juvenile: HabitatObject = {
      id,
      kind: first.kind,
      x: (first.x + second.x) / 2,
      z: (first.z + second.z) / 2,
      rotation: random() * Math.PI * 2,
      scale: 1,
      seed,
      life: {
        age: 0,
        lifespan: newLifespan(random),
        condition: 1,
        breeding: 0,
      },
    };
    objects = [
      ...objects.map((o) =>
        o === first || o === second
          ? { ...o, life: { ...animalLife(o), breeding: 0 } }
          : o,
      ),
      juvenile,
    ];
    log.push({ at: now, event: "born", kind: first.kind });
  }
  if (!log.length) return world;
  return {
    ...world,
    objects,
    log: [...(world.log ?? []), ...log].slice(-LOG_LENGTH),
  };
}

function causeOfDeath(
  object: HabitatObject,
  life: { age: number; lifespan: number },
  homeless: boolean,
  habitat: { food: number; space: number },
): LogEntry["cause"] {
  if (life.age >= life.lifespan) return "age";
  if (homeless)
    return assets[object.kind].habitat === "water" ? "stranded" : "drowned";
  return habitat.food <= habitat.space ? "starved" : "crowded";
}
