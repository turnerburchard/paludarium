import { isAnimal } from "../assets";
import { randomFromSeed } from "./random";
import type { HabitatObject } from "./schema";

// These are game-tuning values in active real seconds, not biological measurements.
export const MATURITY_AGE = 5 * 60;
export const BREEDING_INTERVAL = 8 * 60;

export function animalLife(object: HabitatObject) {
  if (object.life) return object.life;
  const random = randomFromSeed(object.seed);
  const lifespan = newLifespan(random);
  // Placed adults start at different ages so founding pairs don't die together.
  return {
    age: MATURITY_AGE + random() * lifespan * 0.25,
    lifespan,
    condition: 1,
    breeding: 0,
  };
}

/** One and a half to two and a half hours, so a session sees animals come
 * and go without the founders vanishing within the first sitting. */
export function newLifespan(random: () => number) {
  return (1.5 + random()) * 60 * 60;
}

export function juvenileScale(object: HabitatObject) {
  if (!isAnimal(object.kind)) return 1;
  return 0.45 + 0.55 * Math.min(1, animalLife(object).age / MATURITY_AGE);
}
