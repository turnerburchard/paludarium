import type { Discovery } from "./discoveries";
import type { AnimalBehavior } from "../assets/types";

/** Engine units are scene units and simulated seconds. Needs are normalized to 0–1. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export type Surface = "ground" | "glass" | "stem" | "leaf" | "bark" | "stone";
export interface HabitatNode {
  id: string;
  position: Vec3;
  normal: Vec3;
  surface: Surface;
  wet: boolean;
  /** Below the waterline, for animals that walk underwater. */
  submerged?: boolean;
  shelter: number;
  /** The largest footprint that fits here, clear of the glass, stone and
   * wood. Unset where size doesn't matter, as on plants and the glass. */
  room?: number;
  neighbors: string[];
  perchHeight?: number;
  plantId?: string;
  supportId?: string;
}
export interface SpeciesProfile extends AnimalBehavior {
  id: string;
  /** This animal's footprint, so it keeps to places it fits. */
  radius?: number;
}
export interface Needs {
  hunger: number;
  hydration: number;
  energy: number;
}
export type Activity =
  | "exploring"
  | "seeking-food"
  | "eating"
  | "seeking-water"
  | "bathing"
  | "seeking-shelter"
  | "sleeping"
  | "resting";
export interface AnimalSeed {
  id: string;
  species: SpeciesProfile;
  nodeId: string;
  needs?: Needs;
  direction?: Vec3;
}
export interface AnimalState {
  id: string;
  speciesId: string;
  nodeId: string;
  position: Vec3;
  normal: Vec3;
  direction: Vec3;
  needs: Needs;
  activity: Activity;
  reason: string;
  moving: boolean;
  surface: Surface;
  /** At a ground node or walking between two, so it can follow the terrain
   * itself rather than the straight line between nodes. */
  grounded: boolean;
  /** How the current edge is travelled. `hop` is true for the whole edge,
   * including the crouch before takeoff and the landing. */
  motion: { progress: number; lift: number; tilt: number; hop: boolean };
}
/** Insects at one spot. A colony (capacity above zero) breeds back toward its
 * capacity; insects scattered by hand (capacity zero) are simply eaten. */
export interface FoodPatch {
  nodeId: string;
  amount: number;
  capacity: number;
}
export interface SimulationSnapshot {
  elapsed: number;
  phase: "day" | "night";
  animals: AnimalState[];
  food: FoodPatch[];
  discoveries: Discovery[];
}
