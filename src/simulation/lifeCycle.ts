import { assets, categoryOf, isAnimal } from "../assets";
import { plantCondition } from "../model/plants";
import { randomFromSeed } from "../model/random";
import { placementProblem } from "../model/terrain";
import {
  LOG_LENGTH,
  MAX_OBJECTS,
  type HabitatObject,
  type LogEntry,
  type World,
} from "../model/schema";

// These are game-tuning values in active real seconds, not biological measurements.
export const MATURITY_AGE = 15 * 60;
export const BREEDING_INTERVAL = 30 * 60;
const PLANTS_PER_ANIMAL = 1;
const SPACE_PER_ANIMAL = 1;
const SHORTAGE_TOLERANCE = 2 * 60 * 60;
const RECOVERY_TIME = 30 * 60;
/** How long an animal lasts with nowhere it can live, such as a frog in a
 * flooded tank or a fish in a drained one. */
const STRANDED_TOLERANCE = 3 * 60;

export function animalLife(object: HabitatObject) {
  if (object.life) return object.life;
  const random = randomFromSeed(object.seed);
  const lifespan = (3 + random() * 2) * 60 * 60;
  // Placed adults start at different ages so founding pairs don't die together.
  return {
    age: MATURITY_AGE + random() * lifespan * 0.25,
    lifespan,
    condition: 1,
    breeding: 0,
  };
}

export function juvenileScale(object: HabitatObject) {
  if (!isAnimal(object.kind)) return 1;
  return 0.45 + 0.55 * Math.min(1, animalLife(object).age / MATURITY_AGE);
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

/** `stranded` lists the animals with nowhere they can live. Births and
 * deaths are logged at `now`. */
export function advanceLife(
  world: World,
  seconds: number,
  random = Math.random,
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

  let population = objects.filter((o) => isAnimal(o.kind)).length;
  const pairs = new Map<HabitatObject["kind"], HabitatObject>();
  for (const object of objects.slice()) {
    if (!isAnimal(object.kind)) continue;
    const life = animalLife(object);
    if (life.age < MATURITY_AGE || life.breeding < BREEDING_INTERVAL) continue;
    const partner = pairs.get(object.kind);
    if (!partner) {
      pairs.set(object.kind, object);
      continue;
    }
    // New offspring need their own share of food and space.
    if (
      population + 1 > Math.floor(habitat.capacity) ||
      objects.length >= MAX_OBJECTS
    )
      break;
    const seed = Math.floor(random() * 2147483647);
    const birthId = `born:${seed}:${Math.floor(life.age)}`;
    let serial = 0;
    let id = birthId;
    while (objects.some((o) => o.id === id)) id = `${birthId}:${++serial}`;
    const juvenile: HabitatObject = {
      id,
      kind: object.kind,
      x: object.x,
      z: object.z,
      rotation: object.rotation,
      scale: 1,
      seed,
      life: {
        age: 0,
        lifespan: (3 + random() * 2) * 60 * 60,
        condition: 1,
        breeding: 0,
      },
    };
    objects.push(juvenile);
    log.push({ at: now, event: "born", kind: object.kind });
    object.life = { ...life, breeding: 0 };
    partner.life = { ...animalLife(partner), breeding: 0 };
    pairs.delete(object.kind);
    population++;
  }
  if (!log.length) return { ...world, objects };
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
