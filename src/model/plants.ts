import { assets } from "../assets";
import type { Environment, HabitatObject } from "./schema";
import { objectBase } from "./stacking";
import { streamSurface } from "./streams";

/** How far beyond a stream's edge a plant's roots still find its water. */
const ROOT_REACH = 0.5;

/** How wet a plant likes its roots, as height of its spot above the waterline. */
export type Soil = "shore" | "damp" | "drained" | "arid";

const soils: Record<Soil, { min: number; max: number; likes: string }> = {
  shore: { min: 0, max: 0.3, likes: "the water's edge" },
  damp: { min: 0, max: 0.45, likes: "damp ground near the water" },
  drained: { min: 0.25, max: 0.8, likes: "well-drained ground up the bank" },
  arid: { min: 0.35, max: 2, likes: "dry ground well away from the water" },
};

export interface PlantCondition {
  thriving: boolean;
  note: string;
}

/** Whether a plant suits where it's planted. Null for things that aren't plants. */
export function plantCondition(
  object: HabitatObject,
  env: Environment,
): PlantCondition | null {
  const soil = assets[object.kind].soil;
  if (!soil) return null;
  const { min, max, likes } = soils[soil];
  const stream = streamSurface(env, ROOT_REACH)(object.x, object.z);
  const height = objectBase(object, env) - Math.max(env.water, stream ?? 0);
  if (height < min)
    return {
      thriving: false,
      note: `Too wet here. It likes ${likes}.`,
    };
  if (height > max)
    return {
      thriving: false,
      note: `Too dry here. It likes ${likes}.`,
    };
  return { thriving: true, note: `Thriving. It likes ${likes}.` };
}
