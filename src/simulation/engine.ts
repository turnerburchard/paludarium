import { HabitatGraph, copyVector, distance } from "./navigation";
import type {
  Activity,
  AnimalSeed,
  AnimalState,
  FoodPatch,
  SimulationSnapshot,
  SpeciesProfile,
  Vec3,
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
/** Frogs pivot on the spot before setting off at more than this angle (radians)
 * from where they face, at TURN_RATE radians per simulated second. */
const TURN_START = 0.8;
const TURN_RATE = 0.6;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const validAmount = (n: number) => Number.isFinite(n) && n >= 0;
interface Agent {
  state: AnimalState;
  profile: SpeciesProfile;
  path: string[];
  arrival: Activity;
  reconsiderAt: number;
  edge?: { from: Vec3; normal: Vec3; progress: number; distance: number };
  turning?: boolean;
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
          surface: node.surface,
          motion: { progress: 0, lift: 0, tilt: 0, hop: false },
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
  /** Read-only live view for the renderer; use getAnimal/snapshot for owned copies. */
  observeAnimal(id: string): Readonly<AnimalState> | undefined {
    return this.agents.get(id)?.state;
  }
  snapshot(): SimulationSnapshot {
    // HUD snapshots own their data; frame rendering uses observeAnimal instead.
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
    // Frogs don't move to a spot another frog holds or is heading for.
    const taken = new Set(
      [...this.agents.values()]
        .filter((other) => other !== agent)
        .map((other) => other.path.at(-1) ?? other.state.nodeId),
    );
    const reachable = [...paths.keys()].filter(
      (id) => id === state.nodeId || !taken.has(id),
    );
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
            this.graph.node(id).shelter * 3 +
            (this.graph.node(id).surface === "leaf" ? 1 : 0) -
            paths.get(id)!.length * 0.035 +
            this.roll() * 0.25,
        }))
        .sort((a, b) => b.score - a.score);
      go(
        shelters[0].id,
        inactive ? "sleeping" : "resting",
        "seeking-shelter",
        unmet ||
          (this.graph.node(shelters[0].id).surface === "leaf"
            ? "Taking shelter on a leaf perch"
            : inactive
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
    if (!agent.edge && this.turnToward(agent, target.position)) return;
    const edge = (agent.edge ??= {
      from: copyVector(state.position),
      normal: copyVector(state.normal),
      progress: 0,
      distance: distance(state.position, target.position),
    });
    edge.progress = Math.min(
      1,
      edge.progress +
        (agent.profile.speed * STEP) / Math.max(edge.distance, 0.001),
    );
    if (edge.progress >= 1 - 1e-9) {
      state.position = copyVector(target.position);
      state.normal = copyVector(target.normal);
      state.nodeId = target.id;
      state.surface = target.surface;
      state.motion = { progress: 0, lift: 0, tilt: 0, hop: false };
      agent.edge = undefined;
      agent.path.shift();
      if (!agent.path.length) {
        state.moving = false;
        state.activity = agent.arrival;
        agent.reconsiderAt = this.elapsed + 18;
      }
      return;
    }
    const style = agent.profile.movement;
    const leap = state.surface === "leaf" && target.surface === "leaf";
    const hopping =
      style === "hop" ||
      (style === "climb" &&
        (leap || (state.surface === "ground" && target.surface === "ground")));
    const flight = Math.max(0, Math.min(1, (edge.progress - 0.2) / 0.7));
    const travel = hopping ? flight * flight * (3 - 2 * flight) : edge.progress;
    state.direction = {
      x: (target.position.x - edge.from.x) / Math.max(edge.distance, 0.001),
      y: (target.position.y - edge.from.y) / Math.max(edge.distance, 0.001),
      z: (target.position.z - edge.from.z) / Math.max(edge.distance, 0.001),
    };
    state.position = {
      x: edge.from.x + (target.position.x - edge.from.x) * travel,
      y: edge.from.y + (target.position.y - edge.from.y) * travel,
      z: edge.from.z + (target.position.z - edge.from.z) * travel,
    };
    const normal = {
      x: edge.normal.x + (target.normal.x - edge.normal.x) * travel,
      y: edge.normal.y + (target.normal.y - edge.normal.y) * travel,
      z: edge.normal.z + (target.normal.z - edge.normal.z) * travel,
    };
    const length = Math.hypot(normal.x, normal.y, normal.z);
    state.normal =
      length > 0.001
        ? { x: normal.x / length, y: normal.y / length, z: normal.z / length }
        : copyVector(target.normal);
    state.motion = {
      progress: edge.progress,
      hop: hopping,
      lift: hopping
        ? Math.sin(flight * Math.PI) *
          (leap ? 0.18 : style === "hop" ? 0.11 : 0.08)
        : 0,
      tilt: hopping
        ? Math.sin(flight * Math.PI * 2) * 0.13
        : style === "crawl"
          ? Math.sin(edge.progress * Math.PI * 4) * 0.025
          : 0,
    };
  }
  /** Rotates the facing toward a point about the surface normal. Returns
   * whether the animal is still turning and should not set off yet. */
  private turnToward(agent: Agent, point: Vec3) {
    const state = agent.state;
    const facing = alongSurface(state.direction, state.normal);
    const wanted = alongSurface(
      {
        x: point.x - state.position.x,
        y: point.y - state.position.y,
        z: point.z - state.position.z,
      },
      state.normal,
    );
    const angle =
      facing && wanted
        ? Math.acos(Math.max(-1, Math.min(1, dot(facing, wanted))))
        : 0;
    // Once started, finish the turn rather than stopping at the threshold.
    if (angle < (agent.turning ? 0.05 : TURN_START)) {
      agent.turning = false;
      return false;
    }
    agent.turning = true;
    const n = state.normal;
    const side = dot(n, cross(facing!, wanted!)) < 0 ? -1 : 1;
    const step = side * Math.min(angle, TURN_RATE * STEP);
    // Rodrigues' rotation; facing is perpendicular to the normal.
    const across = cross(n, facing!);
    state.direction = {
      x: facing!.x * Math.cos(step) + across.x * Math.sin(step),
      y: facing!.y * Math.cos(step) + across.y * Math.sin(step),
      z: facing!.z * Math.cos(step) + across.z * Math.sin(step),
    };
    state.motion = { progress: 0, lift: 0, tilt: 0, hop: false };
    return true;
  }
  mist() {
    for (const agent of this.agents.values()) {
      agent.state.needs.hydration = clamp(agent.state.needs.hydration + 0.45);
      agent.reconsiderAt = 0;
    }
  }
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
/** The unit direction of `v` within the surface, or undefined if it points along the normal. */
function alongSurface(v: Vec3, normal: Vec3): Vec3 | undefined {
  const along = dot(v, normal);
  const x = v.x - normal.x * along,
    y = v.y - normal.y * along,
    z = v.z - normal.z * along;
  const length = Math.hypot(x, y, z);
  return length < 1e-6
    ? undefined
    : { x: x / length, y: y / length, z: z / length };
}
