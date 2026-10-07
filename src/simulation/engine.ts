import { discoveryFor, type Discovery } from "./discoveries";
import {
  HabitatGraph,
  copyVector,
  distance,
  type HabitatRoutes,
} from "./navigation";
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
/** Energy spent per scene unit walked, on top of what any waking second costs. */
const WALK_ENERGY = 0.0275;
/** Hydration lost per simulated second in the open. */
const HYDRATION_RATE = 0.0014;
/** Colony growth per simulated second. A full-cover colony feeds about one frog. */
const INSECT_GROWTH = 0.01;
/** Newcomers let an emptied colony slowly recover instead of dying out. */
const INSECT_ARRIVALS = 0.05;
/** Frogs pivot on the spot before setting off at more than this angle (radians)
 * from where they face, at TURN_RATE radians per simulated second. */
const TURN_START = 0.18;
const TURN_RATE = 0.9;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const validAmount = (n: number) => Number.isFinite(n) && n >= 0;
interface Agent {
  state: AnimalState;
  previous?: AnimalState;
  rendered?: AnimalState;
  profile: SpeciesProfile;
  path: string[];
  arrival: Activity;
  reconsiderAt: number;
  restFor: number;
  pauseUntil: number;
  recent: string[];
  glanceAt: number;
  glance?: Vec3;
  hasTravelled: boolean;
  routes?: { start: string; navigation: HabitatRoutes };
  edge?: {
    from: Vec3;
    normal: Vec3;
    progress: number;
    distance: number;
    duration: number;
    hop: boolean;
    lift: number;
  };
  turning?: boolean;
}
export interface SimulationOptions {
  random?: () => number;
  speed?: number;
  elapsed?: number;
  food?: FoodPatch[];
  discoveries?: Discovery[];
}

/** Owns live needs and choices. No React, Three.js, wall-clock reads or offline catch-up. */
export class Ecosystem {
  private readonly agents = new Map<string, Agent>();
  private readonly food = new Map<string, FoodPatch>();
  private readonly discoveries: Discovery[];
  private remainder = 0;
  private elapsed: number;
  private readonly random: () => number;
  readonly speed: number;
  constructor(
    readonly graph: HabitatGraph,
    animals: readonly AnimalSeed[],
    options: SimulationOptions = {},
  ) {
    this.discoveries = (options.discoveries ?? [])
      .filter((note) =>
        animals.some(
          (animal) =>
            animal.id === note.animalId && animal.species.id === note.speciesId,
        ),
      )
      .map((note) => ({ ...note }));
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
        restFor: 18,
        pauseUntil: 0,
        recent: [node.id],
        hasTravelled: false,
        glanceAt: this.elapsed + 3 + this.roll() * 9,
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
          grounded: node.surface === "ground",
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
  /** Interpolate the last two fixed steps for frame rendering. This adds one
   * step of latency, without damping quick hops or inventing a second motion. */
  observeRenderedAnimal(id: string): Readonly<AnimalState> | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    const state = agent.state;
    const previous = agent.previous ?? state;
    const rendered = (agent.rendered ??= structuredClone(state));
    Object.assign(rendered, state);
    const t = this.remainder / STEP;
    rendered.position = interpolate(previous.position, state.position, t);
    rendered.normal = interpolate(previous.normal, state.normal, t);
    rendered.direction = interpolate(previous.direction, state.direction, t);
    const landing = previous.motion.hop && previous.nodeId !== state.nodeId;
    rendered.motion = {
      progress:
        previous.motion.progress +
        ((landing ? 1 : state.motion.progress) - previous.motion.progress) * t,
      lift:
        previous.motion.lift + (state.motion.lift - previous.motion.lift) * t,
      tilt:
        previous.motion.tilt + (state.motion.tilt - previous.motion.tilt) * t,
      hop: landing || state.motion.hop,
    };
    if (landing) rendered.moving = true;
    return rendered;
  }
  snapshot(): SimulationSnapshot {
    // HUD snapshots own their data; frame rendering uses observeAnimal instead.
    return {
      elapsed: this.elapsed,
      phase: this.phase,
      animals: [...this.agents.values()].map((a) => structuredClone(a.state)),
      food: [...this.food.values()].map((patch) => ({ ...patch })),
      discoveries: this.discoveries.map((note) => ({ ...note })),
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
        agent.previous = {
          ...agent.state,
          position: copyVector(agent.state.position),
          normal: copyVector(agent.state.normal),
          direction: copyVector(agent.state.direction),
          motion: { ...agent.state.motion },
        };
        if (!heldIds?.has(agent.state.id)) {
          this.update(agent);
          const kind = discoveryFor(agent.state);
          if (kind && !this.discoveries.some((note) => note.kind === kind))
            this.discoveries.push({
              kind,
              animalId: agent.state.id,
              speciesId: agent.state.speciesId,
              elapsed: this.elapsed,
            });
        }
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
    // Grazers feed as they go, on algae the simulation doesn't track.
    if (!agent.profile.grazes)
      needs.hunger = clamp(needs.hunger + STEP * HUNGER_RATE);
    // Cover holds in humidity, so a sheltered animal dries out more slowly.
    const cover = this.graph.node(state.nodeId).shelter;
    needs.hydration = clamp(
      needs.hydration - STEP * HYDRATION_RATE * (1 - 0.6 * cover),
    );
    // Walking costs energy by distance, so slow walkers aren't worn out by
    // the time a trip takes.
    needs.energy = clamp(
      needs.energy -
        STEP *
          (0.0007 + (state.moving ? WALK_ENERGY * agent.profile.speed : 0)),
    );
    // Decide at graph nodes, never teleport to a new path while halfway along an edge.
    if (!state.moving && this.elapsed >= agent.reconsiderAt) this.decide(agent);
    if (state.moving) {
      this.move(agent);
      return;
    }
    if (state.activity === "resting") this.lookAround(agent);
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
    if (agent.routes?.start !== state.nodeId)
      agent.routes = {
        start: state.nodeId,
        navigation: this.graph.routes(state.nodeId, agent.profile),
      };
    const navigation = agent.routes.navigation;
    const lengths = navigation.distances;
    // Frogs don't move to a spot another frog holds or is heading for.
    const taken = new Set(
      [...this.agents.values()]
        .filter((other) => other !== agent)
        .map((other) => other.path.at(-1) ?? other.state.nodeId),
    );
    const reachable = [...lengths.keys()].filter(
      (id) => id === state.nodeId || !taken.has(id),
    );
    const nearest = (ids: string[]) =>
      ids.sort((a, b) => lengths.get(a)! - lengths.get(b)!)[0];
    const insects = (id: string) => this.food.get(id)?.amount ?? 0;
    // A meal is worth the walk; crumbs only when there's nothing better.
    const food =
      nearest(reachable.filter((id) => insects(id) >= 0.5)) ??
      nearest(reachable.filter((id) => insects(id) > 0.001));
    const shoreline = [...lengths.keys()].filter(
      (id) => this.graph.node(id).wet,
    );
    const water = nearest(shoreline.filter((id) => reachable.includes(id)));
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
      agent.path = this.travelPath(state.nodeId, navigation.pathTo(target));
      agent.restFor = duration;
      agent.glance = undefined;
      agent.hasTravelled = false;
      agent.turning = false;
      agent.arrival = arrival;
      state.moving = agent.path.length > 0;
      state.activity = state.moving ? moving : arrival;
      state.reason = reason;
      agent.reconsiderAt = this.elapsed + duration;
    };
    // Slow walkers far from water set off early enough to arrive before
    // they dry out.
    const shore = nearest(shoreline);
    const thirsty =
      needs.hydration <
      Math.max(
        0.4,
        shore
          ? 0.15 + (lengths.get(shore)! / agent.profile.speed) * HYDRATION_RATE
          : 0,
      );
    if (thirsty && water) {
      go(water, "bathing", "seeking-water", "Finding a damp shoreline", 30);
      return;
    }
    // Shoreline is scarce. Rather than give up while another animal soaks,
    // wait at the closest free spot on the way for a turn.
    const busyWater = !water && shore;
    if (thirsty && busyWater) {
      const wait = [state.nodeId, ...navigation.pathTo(busyWater)]
        .filter((id) => id === state.nodeId || !taken.has(id))
        .at(-1)!;
      go(
        wait,
        "resting",
        "seeking-water",
        "Waiting for a turn at the water",
        4,
      );
      return;
    }
    if (needs.hunger > 0.5 && food) {
      go(food, "eating", "seeking-food", "Hunting small insects", 30);
      return;
    }
    const unmet =
      thirsty && !water
        ? "No reachable damp shoreline. Shape a shallow pool or raise the water slightly."
        : needs.hunger > 0.5 && !food
          ? "No insects within reach. Plants and moss give insects cover to breed."
          : "";
    if (inactive || needs.energy < 0.3) {
      if (inactive && state.activity === "sleeping") {
        go(
          state.nodeId,
          "sleeping",
          "seeking-shelter",
          unmet || state.reason,
          40 + this.roll() * 35,
        );
        return;
      }
      const restsOn = agent.profile.restsOn ?? ["leaf"];
      const shelters = reachable
        .map((id) => ({
          id,
          score:
            this.graph.node(id).shelter * 3 +
            (restsOn.includes(this.graph.node(id).surface) ? 1 : 0) -
            // Slow walkers settle for nearer cover.
            (lengths.get(id)! * 0.008) / agent.profile.speed +
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
    // Vary the reach of each outing and favor unfamiliar spots, with a mild
    // bias toward the current heading. Needs still take precedence over curiosity.
    const range = 0.7 + this.roll() * 2.1;
    const candidates = reachable.filter(
      (id) => id !== state.nodeId && lengths.get(id)! <= range,
    );
    if (candidates.length && this.roll() > 0.2) {
      const weights = candidates.map((id) => {
        const first = this.graph.node(navigation.firstSteps.get(id)!).position;
        const direction = alongSurface(
          {
            x: first.x - state.position.x,
            y: first.y - state.position.y,
            z: first.z - state.position.z,
          },
          state.normal,
        );
        const facing = alongSurface(state.direction, state.normal);
        const ahead =
          direction && facing ? (dot(direction, facing) + 1) / 2 : 0.5;
        const fresh = agent.recent.includes(id) ? 0.12 : 1;
        const perch = this.graph.node(id).surface === "leaf" ? 1.5 : 1;
        return fresh * perch * (0.5 + ahead) * (0.3 + lengths.get(id)! / range);
      });
      let choice =
        this.roll() * weights.reduce((sum, weight) => sum + weight, 0);
      let index = 0;
      while (index < weights.length - 1 && choice >= weights[index])
        choice -= weights[index++];
      go(
        candidates[index],
        "resting",
        "exploring",
        unmet || "Exploring the habitat",
        3 + this.roll() * 21,
      );
    } else
      go(
        state.nodeId,
        "resting",
        "exploring",
        unmet || "Watching the habitat",
        5 + this.roll() * 25,
      );
  }
  /** Small graph cells describe the surface, not separate steps. Combine
   * straight, gently sloping stretches without cutting across corners. */
  private travelPath(start: string, path: readonly string[]) {
    const result: string[] = [];
    let previous = this.graph.node(start);
    for (let i = 0; i < path.length; i++) {
      let target = this.graph.node(path[i]);
      while (i + 1 < path.length) {
        const next = this.graph.node(path[i + 1]);
        if (
          previous.surface !== target.surface ||
          target.surface !== next.surface ||
          !["ground", "stone", "bark"].includes(target.surface) ||
          Math.min(previous.normal.y, target.normal.y, next.normal.y) < 0.85 ||
          distance(previous.position, next.position) > 0.48
        )
          break;
        const a = {
          x: target.position.x - previous.position.x,
          y: target.position.y - previous.position.y,
          z: target.position.z - previous.position.z,
        };
        const b = {
          x: next.position.x - target.position.x,
          y: next.position.y - target.position.y,
          z: next.position.z - target.position.z,
        };
        if (
          dot(a, b) /
            Math.max(
              distance(previous.position, target.position) *
                distance(target.position, next.position),
              0.001,
            ) <
          0.995
        )
          break;
        target = next;
        i++;
      }
      result.push(target.id);
      previous = target;
    }
    return result;
  }
  private lookAround(agent: Agent) {
    const state = agent.state;
    if (this.elapsed >= agent.glanceAt) {
      const forward = alongSurface(state.direction, state.normal);
      if (forward) {
        const side = cross(state.normal, forward);
        const angle = (this.roll() - 0.5) * 1.8;
        agent.glance = {
          x:
            state.position.x +
            forward.x * Math.cos(angle) +
            side.x * Math.sin(angle),
          y:
            state.position.y +
            forward.y * Math.cos(angle) +
            side.y * Math.sin(angle),
          z:
            state.position.z +
            forward.z * Math.cos(angle) +
            side.z * Math.sin(angle),
        };
      }
      agent.glanceAt = this.elapsed + 4 + this.roll() * 14;
    }
    if (agent.glance && !this.turnToward(agent, agent.glance))
      agent.glance = undefined;
  }
  private move(agent: Agent) {
    const state = agent.state;
    if (this.elapsed < agent.pauseUntil) return;
    const target = this.graph.node(agent.path[0]);
    const style = agent.profile.movement;
    const leap = state.surface === "leaf" && target.surface === "leaf";
    const walks = (surface: AnimalState["surface"]) =>
      ["ground", "stone", "bark"].includes(surface);
    const hopping =
      (style === "hop" || style === "climb") &&
      (leap ||
        (walks(state.surface) &&
          walks(target.surface) &&
          Math.min(state.normal.y, target.normal.y) >= 0.85));
    if (
      !agent.edge &&
      this.turnToward(
        agent,
        target.position,
        agent.hasTravelled && !hopping ? 0.65 : TURN_START,
      )
    )
      return;
    if (!agent.edge) {
      const length = distance(state.position, target.position);
      agent.edge = {
        from: copyVector(state.position),
        normal: copyVector(state.normal),
        progress: 0,
        distance: length,
        // Hops are bursts, independent of the slow cruising speed used to
        // crawl up stems. At normal simulation speed a hop lasts about 0.4s.
        duration: hopping
          ? (1.6 + Math.sqrt(length) * 1.3) * (0.9 + this.roll() * 0.2)
          : (length / agent.profile.speed) * (0.85 + this.roll() * 0.3),
        hop: hopping,
        lift: leap ? 0.2 : Math.min(0.16, 0.06 + length * 0.24),
      };
    }
    const edge = agent.edge;
    edge.progress = Math.min(
      1,
      edge.progress + STEP / Math.max(edge.duration, STEP),
    );
    if (edge.progress >= 1 - 1e-9) {
      state.position = copyVector(target.position);
      state.normal = copyVector(target.normal);
      state.nodeId = target.id;
      state.surface = target.surface;
      state.grounded = target.surface === "ground";
      state.motion = { progress: 0, lift: 0, tilt: 0, hop: false };
      agent.edge = undefined;
      agent.path.shift();
      agent.hasTravelled = true;
      agent.recent.push(target.id);
      if (agent.recent.length > 20) agent.recent.shift();
      const urgentWater =
        state.needs.hydration < 0.25 && state.activity !== "seeking-water";
      const urgentFood =
        state.needs.hunger > 0.8 &&
        state.activity !== "seeking-food" &&
        state.activity !== "seeking-water";
      const canHelp =
        (urgentWater || urgentFood) &&
        [...agent.routes!.navigation.distances.keys()].some(
          (id) =>
            (urgentWater && this.graph.node(id).wet) ||
            (urgentFood && (this.food.get(id)?.amount ?? 0) > 0.001),
        );
      const occupied = [...this.agents.values()].some(
        (other) =>
          other !== agent &&
          (other.state.nodeId === target.id || other.path.at(-1) === target.id),
      );
      // An unmet need is not a reason to abandon a route at every cell, or
      // stop on another animal's resting spot. Redirect only where help exists.
      if (agent.path.length && canHelp && !occupied) {
        agent.path = [];
        agent.reconsiderAt = 0;
        state.moving = false;
        return;
      }
      if (!agent.path.length) {
        state.moving = false;
        state.activity = agent.arrival;
        agent.reconsiderAt = this.elapsed + agent.restFor;
        agent.glanceAt = this.elapsed + 2 + this.roll() * 7;
      } else if (edge.hop || style === "scurry") {
        agent.pauseUntil =
          this.elapsed +
          (edge.hop ? 0.8 + this.roll() * 3 : 0.4 + this.roll() * 1.4);
      }
      return;
    }
    const flight = Math.max(0, Math.min(1, (edge.progress - 0.2) / 0.7));
    // Constant forward velocity in flight, with a ballistic rise and fall.
    // Easing the whole jump makes it look as though it is swimming through air.
    const travel = edge.hop
      ? flight
      : style === "scurry"
        ? edge.progress * edge.progress * (3 - 2 * edge.progress)
        : edge.progress;
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
    state.grounded =
      !edge.hop && state.surface === "ground" && target.surface === "ground";
    const length = Math.hypot(normal.x, normal.y, normal.z);
    state.normal =
      length > 0.001
        ? { x: normal.x / length, y: normal.y / length, z: normal.z / length }
        : copyVector(target.normal);
    state.motion = {
      progress: edge.progress,
      hop: edge.hop,
      lift: edge.hop ? 4 * flight * (1 - flight) * edge.lift : 0,
      tilt: edge.hop
        ? Math.sin(flight * Math.PI * 2) * 0.13
        : style === "crawl"
          ? Math.sin(edge.progress * Math.PI * 4) * 0.025
          : 0,
    };
  }
  /** Rotates the facing toward a point about the surface normal. Returns
   * whether the animal is still turning and should not set off yet. */
  private turnToward(agent: Agent, point: Vec3, threshold = TURN_START) {
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
    if (angle < (agent.turning ? 0.05 : threshold)) {
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
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const interpolate = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
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
