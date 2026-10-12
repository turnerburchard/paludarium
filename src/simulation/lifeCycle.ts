import { assets, categoryOf, isAnimal } from "../assets";
import {
  animalLife,
  newBreedingInterval,
  lifeStage,
  MATURITY_AGE,
  newLifespan,
} from "../model/life";
import { plantCondition } from "../model/plants";
import { objectBase } from "../model/stacking";
import { placementProblem, waterLevel } from "../model/water";
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
    id,
    cause: "killed",
  };
  return {
    ...world,
    objects: world.objects.filter((o) => o.id !== id),
    log: [...(world.log ?? []), death].slice(-LOG_LENGTH),
  };
}

export function habitatSupport(world: World) {
  const land = { population: 0, plants: 0 };
  const aquatic = { population: 0, plants: 0 };
  for (const object of world.objects) {
    const asset = assets[object.kind];
    if (isAnimal(object.kind)) {
      (asset.habitat === "water" ? aquatic : land).population++;
      continue;
    }
    const planted =
      categoryOf(asset) === "Plants" ||
      asset.soil !== undefined ||
      object.kind === "java-moss";
    if (
      !planted ||
      plantCondition(object, world.environment)?.thriving === false ||
      placementProblem(
        object.kind,
        object.x,
        object.z,
        world.environment,
        object.lift ?? 0,
      )
    )
      continue;
    // Amphibious plants feed the habitat they are actually planted in.
    const inWater =
      asset.habitat === "water" ||
      (asset.habitat === "either" &&
        objectBase(object, world.environment) <
          waterLevel(object.x, object.z, world.environment));
    (inWater ? aquatic : land).plants++;
  }
  const population = land.population + aquatic.population;
  const plants = land.plants + aquatic.plants;
  const spaceCapacity =
    (world.environment.width * world.environment.depth) / SPACE_PER_ANIMAL;
  const foodSupport = (group: typeof land) => ({
    ...group,
    capacity: group.plants / PLANTS_PER_ANIMAL,
    food: group.population
      ? Math.min(1, group.plants / PLANTS_PER_ANIMAL / group.population)
      : 1,
  });
  const landSupport = foodSupport(land);
  const aquaticSupport = foodSupport(aquatic);
  return {
    population,
    plants,
    capacity: Math.min(plants / PLANTS_PER_ANIMAL, spaceCapacity),
    food: Math.min(landSupport.food, aquaticSupport.food),
    space: population ? Math.min(1, spaceCapacity / population) : 1,
    land: landSupport,
    aquatic: aquaticSupport,
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
  const log: LogEntry[] = [];
  const objects = world.objects.flatMap((object) => {
    if (!isAnimal(object.kind)) return [object];
    const group =
      assets[object.kind].habitat === "water" ? habitat.aquatic : habitat.land;
    const support = Math.min(group.food, habitat.space);
    const previous = animalLife(object);
    const homeless = stranded.has(object.id);
    let change = 1 / RECOVERY_TIME;
    if (homeless) change = -1 / STRANDED_TOLERANCE;
    else if (support < 1) change = -(1 - support) / SHORTAGE_TOLERANCE;
    const condition = Math.max(
      0,
      Math.min(1, previous.condition + seconds * change),
    );
    const well = condition >= 0.6 && support >= 1 && !homeless;
    // Cooldown and readiness run consecutively, even across a long life tick.
    const available = Math.max(0, seconds - previous.breedingCooldown);
    const life = {
      ...previous,
      age: previous.age + seconds,
      condition,
      breedingCooldown: Math.max(0, previous.breedingCooldown - seconds),
      breeding: well
        ? Math.min(previous.breedingTarget, previous.breeding + available)
        : Math.max(0, previous.breeding - seconds),
    };
    if (life.age >= life.lifespan || life.condition <= 0) {
      log.push({
        at: now,
        event: "died",
        kind: object.kind,
        id: object.id,
        cause: causeOfDeath(object, life, homeless, {
          food: group.food,
          space: habitat.space,
        }),
      });
      return [];
    }
    const stage = lifeStage(life);
    if (stage !== lifeStage(previous))
      log.push({
        at: now,
        event: stage === "older" ? "grew-old" : "grew-up",
        kind: object.kind,
        id: object.id,
      });
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
        const group =
          assets[object.kind].habitat === "water"
            ? habitat.aquatic
            : habitat.land;
        if (group.population + 1 > Math.floor(group.capacity)) return false;
        const life = animalLife(object);
        return (
          life.age >= MATURITY_AGE &&
          life.condition >= 0.6 &&
          life.breedingCooldown === 0 &&
          life.breeding >= life.breedingTarget
        );
      })
      .map((object) => object.id),
  );
}

/** Each juvenile, with those of its parents still alive. */
export function youngAndParents(world: World): Map<string, string[]> {
  const living = new Set(world.objects.map((o) => o.id));
  return new Map(
    world.objects
      .filter((o) => isAnimal(o.kind) && animalLife(o).age < MATURITY_AGE)
      .map((o) => [o.id, (o.parents ?? []).filter((id) => living.has(id))]),
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
      parents: [first.id, second.id],
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
          ? {
              ...o,
              courtship: undefined,
              life: {
                ...animalLife(o),
                breeding: 0,
                breedingTarget: newBreedingInterval(random),
                breedingCooldown: 60 + random() * 60,
              },
            }
          : o,
      ),
      juvenile,
    ];
    log.push({ at: now, event: "born", kind: first.kind, id });
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

/** Store the live pair and its progress alongside animal positions. */
export function withAnimalCourtships(
  world: World,
  courtships: readonly {
    id: string;
    mate: string;
    together: number;
    elapsed: number;
  }[],
): World {
  const saved = new Map(
    courtships.map(({ id, ...courtship }) => [id, courtship]),
  );
  return {
    ...world,
    objects: world.objects.map((object) => {
      if (!isAnimal(object.kind)) return object;
      const courtship = saved.get(object.id);
      if (!courtship && !object.courtship) return object;
      return { ...object, courtship };
    }),
  };
}
