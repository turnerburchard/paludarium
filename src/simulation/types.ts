/** Engine units are scene units and simulated seconds. Needs are normalized to 0–1. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export type Surface = "ground" | "glass";
export interface HabitatNode {
  id: string;
  position: Vec3;
  normal: Vec3;
  surface: Surface;
  wet: boolean;
  shelter: number;
  neighbors: string[];
}
export interface SpeciesProfile {
  id: string;
  nocturnal: boolean;
  climbs: boolean;
  speed: number;
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
}
export interface FoodPatch {
  nodeId: string;
  amount: number;
}
export interface SimulationSnapshot {
  elapsed: number;
  phase: "day" | "night";
  animals: AnimalState[];
  food: FoodPatch[];
}
