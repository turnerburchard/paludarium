import type { FrogBehavior } from "../assets/types";

/** Engine units are scene units and simulated seconds. Needs are normalized to 0–1. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export type Surface = "ground" | "glass" | "stem" | "leaf" | "bark";
export interface HabitatNode {
  id: string;
  position: Vec3;
  normal: Vec3;
  surface: Surface;
  wet: boolean;
  shelter: number;
  neighbors: string[];
  perchHeight?: number;
  plantId?: string;
}
export interface SpeciesProfile extends FrogBehavior {
  id: string;
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
}
