import { HabitatGraph, copyVector, distance } from "./navigation";
import type {
  Activity,
  AnimalSeed,
  AnimalState,
  FoodPatch,
  SimulationSnapshot,
  SpeciesProfile,
} from "./types";

const STEP = 0.1;
const DAY_LENGTH = 1800;
/** Hunger gained per simulated second, and removed by eating one insect portion. */
const HUNGER_RATE = 0.002;
const HUNGER_PER_PORTION = 0.2;
/** Colony growth per simulated second. A full-cover colony feeds about one frog. */
const INSECT_GROWTH = 0.01;
/** Newcomers let an emptied colony slowly recover instead of dying out. */
const INSECT_ARRIVALS = 0.05;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const validAmount = (n: number) => Number.isFinite(n) && n >= 0;
interface Agent {
  state: AnimalState;
  profile: SpeciesProfile;
  path: string[];
  arrival: Activity;
  reconsiderAt: number;
}
export interface SimulationOptions {
  random?: () => number;
  speed?: number;
  elapsed?: number;
  food?: FoodPatch[];
}

/** Roughly how many frogs the colonies can feed indefinitely. A logistic colony
 * yields the most, a quarter of growth rate times capacity, when half full. */
export function frogsSupported(food: readonly FoodPatch[]): number {
  const insectsPerSecond = food.reduce(
    (sum, patch) => sum + (INSECT_GROWTH * patch.capacity) / 4,
    0,
  );
  return insectsPerSecond / (HUNGER_RATE / HUNGER_PER_PORTION);
}

/** Owns live needs and choices. No React, Three.js, wall-clock reads or offline catch-up. */
export class Ecosystem {
  private readonly agents = new Map<string, Agent>();
  private readonly food = new Map<string, FoodPatch>();
  private remainder = 0;
  private elapsed: number;
  private readonly random: () => number;
  readonly speed: number;
  constructor(
    readonly graph: HabitatGraph,
    animals: readonly AnimalSeed[],
    options: SimulationOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    this.speed = options.speed ?? 6;
    this.elapsed = options.elapsed ?? DAY_LENGTH * 0.42;
    if (
      !Number.isFinite(this.speed) ||
      this.speed <= 0 ||
      this.speed > 24 ||
      !Number.isFinite(this.elapsed) ||
      this.elapsed < 0
    )
      throw new Error("Invalid simulation clock.");
    for (const animal of animals) {
      if (this.agents.has(animal.id))
        throw new Error(`Duplicate animal: ${animal.id}`);
      if (!graph.allowed(animal.nodeId, animal.species))
        throw new Error("Animal cannot use its starting surface.");
      if (!Number.isFinite(animal.species.speed) || animal.species.speed <= 0)
        throw new Error("Animal speed must be positive.");
      const node = graph.node(animal.nodeId);
      const needs = animal.needs ?? {
        hunger: 0.2 + this.roll() * 0.2,
        hydration: 0.8,
        energy: 0.8,
      };
      if (
        !Object.values(needs).every(
          (n) => Number.isFinite(n) && n >= 0 && n <= 1,
        )
      )
        throw new Error("Invalid needs.");
      this.agents.set(animal.id, {
        profile: { ...animal.species },
        path: [],
        arrival: "resting",
        reconsiderAt: 0,
        state: {
          id: animal.id,
          speciesId: animal.species.id,
          nodeId: node.id,
          position: copyVector(node.position),
          normal: copyVector(node.normal),
          direction: animal.direction
            ? copyVector(animal.direction)
            : { x: 0, y: 0, z: -1 },
          needs: { ...needs },
          activity: "resting",
          reason: "Settling in",
          moving: false,
        },
      });
    }
    for (const patch of options.food ?? []) {
      this.graph.node(patch.nodeId);
      if (![patch.amount, patch.capacity].every(validAmount))
        throw new Error("Food amounts must be finite and non-negative.");
      this.food.set(patch.nodeId, { ...patch });
    }
  }
  private roll() {
    const n = this.random();
    if (!Number.isFinite(n) || n < 0 || n >= 1)
      throw new Error("Random source must return a value in [0, 1).");
    return n;
  }
  get phase(): "day" | "night" {
    return this.elapsed % DAY_LENGTH < DAY_LENGTH / 2 ? "day" : "night";
  }
  getAnimal(id: string): AnimalState | undefined {
    const state = this.agents.get(id)?.state;
    return state ? structuredClone(state) : undefined;
  }
  snapshot(): SimulationSnapshot {
    return {
      elapsed: this.elapsed,
      phase: this.phase,
      animals: [...this.agents.values()].map((a) => structuredClone(a.state)),
      food: [...this.food.values()].map((patch) => ({ ...patch })),
    };
  }
  addFood(nodeId: string, amount: number) {
    this.graph.node(nodeId);
    if (!validAmount(amount))
      throw new Error("Food amounts must be finite and non-negative.");
    const patch = this.food.get(nodeId) ?? { nodeId, amount: 0, capacity: 0 };
    patch.amount = Math.min(30, patch.amount + amount);
    this.food.set(nodeId, patch);
    for (const agent of this.agents.values()) agent.reconsiderAt = 0;
  }
  /** Long frames are discarded. A hidden tab never turns into hours of simulation. */
  advance(realSeconds: number, paused = false, heldIds?: ReadonlySet<string>) {
    if (!Number.isFinite(realSeconds) || realSeconds < 0)
      throw new Error("Frame delta must be finite and non-negative.");
    if (paused) return;
    this.remainder += Math.min(realSeconds, 0.25) * this.speed;
    while (this.remainder >= STEP - 1e-9) {
      this.remainder = Math.max(0, this.remainder - STEP);
      this.elapsed += STEP;
      // Rotate update order so one animal does not always get the final bite.
      const agents = [...this.agents.values()];
      const offset =
        Math.floor(this.elapsed / STEP) % Math.max(1, agents.length);
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[(i + offset) % agents.length];
        if (!heldIds?.has(agent.state.id)) this.update(agent);
      }
      this.breedInsects();
    }
  }
  /** Logistic growth: fast when a colony is small, leveling off at capacity. */
  private breedInsects() {
    for (const patch of this.food.values()) {
      if (patch.amount >= patch.capacity) continue;
      const growth =
        INSECT_GROWTH *
        (patch.amount + INSECT_ARRIVALS) *
        (1 - patch.amount / patch.capacity);
      patch.amount = Math.min(patch.capacity, patch.amount + STEP * growth);
    }
  }
  private update(agent: Agent) {
    const state = agent.state,
      needs = state.needs;
    needs.hunger = clamp(needs.hunger + STEP * HUNGER_RATE);
    needs.hydration = clamp(needs.hydration - STEP * 0.0014);
    needs.energy = clamp(
      needs.energy - STEP * (state.moving ? 0.0018 : 0.0007),
    );
    // Decide at graph nodes, never teleport to a new path while halfway along an edge.
    if (!state.moving && this.elapsed >= agent.reconsiderAt) this.decide(agent);
    if (state.moving) {
      this.move(agent);
      return;
    }
    if (state.activity === "eating") {
      const patch = this.food.get(state.nodeId);
      const available = patch?.amount ?? 0;
      const bite = Math.min(
        available,
        STEP * 0.22,
        needs.hunger / HUNGER_PER_PORTION,
      );
      if (patch) patch.amount = Math.max(0, available - bite);
      needs.hunger = clamp(needs.hunger - bite * HUNGER_PER_PORTION);
      if (available < 0.001 || needs.hunger < 0.12) agent.reconsiderAt = 0;
    } else if (state.activity === "bathing") {
      needs.hydration = clamp(needs.hydration + STEP * 0.035);
      if (needs.hydration > 0.95) agent.reconsiderAt = 0;
    } else if (state.activity === "resting" || state.activity === "sleeping") {
      needs.energy = clamp(
        needs.energy + STEP * (state.activity === "sleeping" ? 0.012 : 0.006),
      );
    }
  }
  private decide(agent: Agent) {
    const state = agent.state,
      needs = state.needs;
    const paths = this.graph.paths(state.nodeId, agent.profile);
    const reachable = [...paths.keys()];
    const nearest = (ids: string[]) =>
      ids.sort((a, b) => paths.get(a)!.length - paths.get(b)!.length)[0];
    const food = nearest(
      reachable.filter((id) => (this.food.get(id)?.amount ?? 0) > 0.001),
    );
    const water = nearest(reachable.filter((id) => this.graph.node(id).wet));
    const inactive = agent.profile.nocturnal
      ? this.phase === "day"
      : this.phase === "night";
    const go = (
      target: string,
      arrival: Activity,
      moving: Activity,
      reason: string,
      duration = 18,
    ) => {
      agent.path = [...paths.get(target)!];
      agent.arrival = arrival;
      state.moving = agent.path.length > 0;
      state.activity = state.moving ? moving : arrival;
      state.reason = reason;
      agent.reconsiderAt = this.elapsed + duration;
    };
    if (needs.hydration < 0.4 && water) {
      go(water, "bathing", "seeking-water", "Finding a damp shoreline", 30);
      return;
    }
    if (needs.hunger > 0.5 && food) {
      go(food, "eating", "seeking-food", "Hunting small insects", 30);
      return;
    }
    const unmet =
      needs.hydration < 0.4 && !water
        ? "No reachable damp shoreline. Raise the water slightly or mist the habitat."
        : needs.hunger > 0.5 && !food
          ? "No insects within reach. Plants and moss give insects cover to breed."
          : "";
    if (inactive || needs.energy < 0.3) {
      const shelters = reachable
        .map((id) => ({
          id,
          score:
            this.graph.node(id).shelter * 3 -
            paths.get(id)!.length * 0.035 +
            this.roll() * 0.25,
        }))
        .sort((a, b) => b.score - a.score);
      go(
        shelters[0].id,
        inactive ? "sleeping" : "resting",
        "seeking-shelter",
        unmet ||
          (inactive
            ? "Resting during the quiet part of the day"
            : "Recovering energy"),
        25,
      );
      return;
    }
    // Short, varied outings with pauses. Avoid cycling between distant goals every frame.
    const candidates = reachable.filter(
      (id) => id !== state.nodeId && paths.get(id)!.length <= 7,
    );
    if (candidates.length && this.roll() > 0.3) {
      const target = candidates[Math.floor(this.roll() * candidates.length)];
      go(
        target,
        "resting",
        "exploring",
        unmet || "Exploring the habitat",
        8 + this.roll() * 18,
      );
    } else
      go(
        state.nodeId,
        "resting",
        "exploring",
        unmet || "Watching the habitat",
        8 + this.roll() * 18,
      );
  }
  private move(agent: Agent) {
    const state = agent.state;
    const target = this.graph.node(agent.path[0]);
    const d = distance(state.position, target.position),
      step = agent.profile.speed * STEP;
    if (d <= step) {
      state.position = copyVector(target.position);
      state.normal = copyVector(target.normal);
      state.nodeId = target.id;
      agent.path.shift();
      if (!agent.path.length) {
        state.moving = false;
        state.activity = agent.arrival;
        agent.reconsiderAt = this.elapsed + 18;
      }
      return;
    }
    state.direction = {
      x: (target.position.x - state.position.x) / d,
      y: (target.position.y - state.position.y) / d,
      z: (target.position.z - state.position.z) / d,
    };
    state.position = {
      x: state.position.x + state.direction.x * step,
      y: state.position.y + state.direction.y * step,
      z: state.position.z + state.direction.z * step,
    };
    // Keep the starting surface orientation until the actual edge transition.
  }
  mist() {
    for (const agent of this.agents.values()) {
      agent.state.needs.hydration = clamp(agent.state.needs.hydration + 0.45);
      agent.reconsiderAt = 0;
    }
  }
}
