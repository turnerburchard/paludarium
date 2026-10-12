import { isAnimal } from "../assets";
import { randomFromSeed } from "./random";
import type { HabitatObject } from "./schema";

// These are game-tuning values in active real seconds, not biological measurements.
export const MATURITY_AGE = 5 * 60;
export const BREEDING_INTERVAL = 8 * 60;

/** A fresh readiness interval after each birth, in active real seconds. */
export function newBreedingInterval(random: () => number) {
  return 4 * 60 + random() * (BREEDING_INTERVAL - 4 * 60);
}

export function animalLife(object: HabitatObject) {
  const breedingTarget = 30 + randomFromSeed(object.seed)() * 60;
  if (object.life)
    return {
      ...object.life,
      breedingTarget: object.life.breedingTarget ?? breedingTarget,
      breedingCooldown: object.life.breedingCooldown ?? 0,
    };
  const random = randomFromSeed(object.seed);
  const lifespan = newLifespan(random);
  // Placed adults start at different ages so founding pairs don't die together.
  return {
    age: MATURITY_AGE + random() * lifespan * 0.25,
    lifespan,
    condition: 1,
    breeding: 0,
    breedingTarget,
    breedingCooldown: 0,
  };
}

/** One and a half to two and a half hours, so a session sees animals come
 * and go without the founders vanishing within the first sitting. */
export function newLifespan(random: () => number) {
  return (1.5 + random()) * 60 * 60;
}

export type LifeStage = "juvenile" | "adult" | "older";
/** Older adults are in the last fifth of their lives. */
export function lifeStage(life: { age: number; lifespan: number }): LifeStage {
  if (life.age < MATURITY_AGE) return "juvenile";
  return life.age > life.lifespan * 0.8 ? "older" : "adult";
}

export function juvenileScale(object: HabitatObject) {
  if (!isAnimal(object.kind)) return 1;
  return 0.45 + 0.55 * Math.min(1, animalLife(object).age / MATURITY_AGE);
}
