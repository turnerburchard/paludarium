import { discoveryFor, type Discovery } from "./discoveries";
import {
  HabitatGraph,
  copyVector,
  distance,
  type HabitatRoutes,
} from "./navigation";
import type {
  Activity,
  HabitatNode,
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
  blocked: Map<string, Set<string>>;
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
    progress: number;
    duration: number;
    hop: boolean;
    backwards: boolean;
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
      const direction = graph.startingDirection(
        node,
        animal.species,
        animal.direction ?? { x: 0, y: 0, z: -1 },
      );
      const pose = graph.place(
        node.position,
        node.normal,
        direction,
        node.surface,
        animal.species,
        !!node.shelterId,
        node.supportId,
      );
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
        blocked: new Map(),
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
          position: pose.position,
          normal: pose.normal,
          direction: copyVector(direction),
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
    if (rendered.surface === "ground" && previous.surface === "ground") {
      const pose = this.graph.place(
        rendered.position,
        rendered.normal,
        rendered.direction,
        rendered.surface,
        agent.profile,
        !!this.graph.node(state.nodeId).shelterId,
      );
      rendered.position = pose.position;
      rendered.normal = pose.normal;
    }
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
    // Animals that live underwater never dry out.
    const cover = this.graph.node(state.nodeId).shelter;
    if (agent.profile.water !== "lives")
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
    if (agent.routes?.start !== state.nodeId) {
      agent.routes = {
        start: state.nodeId,
        navigation: this.graph.routes(
          state.nodeId,
          agent.profile,
          agent.blocked,
        ),
      };
    }
    if (agent.blocked.has(state.nodeId)) {
      const from = this.graph.node(state.nodeId);
      let reopened = false;
      for (const id of agent.blocked.get(from.id) ?? []) {
        if (this.moveDirection(agent, from, this.graph.node(id)) === undefined)
          continue;
        agent.blocked.get(from.id)!.delete(id);
        reopened = true;
      }
      if (reopened)
        agent.routes.navigation = this.graph.routes(
          state.nodeId,
          agent.profile,
          agent.blocked,
        );
    }
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
      ids
        .sort((a, b) => lengths.get(a)! - lengths.get(b)!)
        .find((id) => this.graph.allowed(id, agent.profile));
    const insects = (id: string) => this.food.get(id)?.amount ?? 0;
    // A meal is worth the walk; crumbs only when there's nothing better.
    const food =
      nearest(reachable.filter((id) => insects(id) >= 0.5)) ??
      nearest(reachable.filter((id) => insects(id) > 0.001));
    // Animals that visit the water soak in it rather than on the shore.
    const shoreline = [...lengths.keys()].filter((id) =>
      agent.profile.water === "visits"
        ? this.graph.node(id).submerged
        : this.graph.node(id).wet,
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
      agent.path = this.travelPath(
        state.nodeId,
        navigation.pathTo(target),
        agent.profile,
        state.direction,
        agent.blocked,
      );
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
      go(
        water,
        "bathing",
        "seeking-water",
        agent.profile.water === "visits"
          ? "Heading into the water"
          : "Finding a damp shoreline",
        30,
      );
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
      const shelter = shelters.find(({ id }) =>
        this.graph.allowed(id, agent.profile),
      )!;
      go(
        shelter.id,
        inactive ? "sleeping" : "resting",
        "seeking-shelter",
        unmet ||
          (this.graph.node(shelter.id).surface === "leaf"
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
        const node = this.graph.node(id);
        const perch = node.surface === "leaf" ? 1.5 : 1;
        // Animals that visit the water like to poke around underwater.
        const dip = agent.profile.water === "visits" && node.submerged ? 3 : 1;
        return (
          fresh * perch * dip * (0.5 + ahead) * (0.3 + lengths.get(id)! / range)
        );
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
  private travelPath(
    start: string,
    path: readonly string[],
    species: SpeciesProfile,
    facing: Vec3,
    blocked: ReadonlyMap<string, ReadonlySet<string>>,
  ) {
    const result: string[] = [];
    let previous = this.graph.node(start);
    for (let i = 0; i < path.length; i++) {
      let target = this.graph.node(path[i]);
      while (i + 1 < path.length) {
        const next = this.graph.node(path[i + 1]);
        const wanted = {
          x: next.position.x - previous.position.x,
          y: next.position.y - previous.position.y,
          z: next.position.z - previous.position.z,
        };
        if (
          blocked.get(previous.id)?.has(next.id) ||
          (!result.length &&
            !this.graph.canTurn(previous, facing, wanted, species)) ||
          !this.graph.canTravel(previous, next, species) ||
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
  private blockMove(agent: Agent, from: string, to: string) {
    let blocked = agent.blocked.get(from);
    if (!blocked) agent.blocked.set(from, (blocked = new Set()));
    blocked.add(to);
  }
  private moveDirection(agent: Agent, from: HabitatNode, to: HabitatNode) {
    const wanted = {
      x: to.position.x - from.position.x,
      y: to.position.y - from.position.y,
      z: to.position.z - from.position.z,
    };
    const reverse = { x: -wanted.x, y: -wanted.y, z: -wanted.z };
    if (
      this.graph.canTravel(from, to, agent.profile) &&
      this.graph.canTurn(from, agent.state.direction, wanted, agent.profile)
    )
      return false;
    if (
      this.graph.canTravel(from, to, agent.profile, false, true) &&
      this.graph.canTurn(from, agent.state.direction, reverse, agent.profile)
    )
      return true;
    return undefined;
  }
  private move(agent: Agent) {
    const state = agent.state;
    if (this.elapsed < agent.pauseUntil) return;
    const target = this.graph.node(agent.path[0]);
    const style = agent.profile.movement;
    const leap = state.surface === "leaf" && target.surface === "leaf";
    const walks = (surface: AnimalState["surface"]) =>
      ["ground", "stone", "bark"].includes(surface);
    const from = this.graph.node(state.nodeId);
    const wanted = {
      x: target.position.x - from.position.x,
      y: target.position.y - from.position.y,
      z: target.position.z - from.position.z,
    };
    const backwards =
      agent.edge?.backwards ?? this.moveDirection(agent, from, target);
    if (backwards === undefined) {
      this.blockMove(agent, from.id, target.id);
      agent.path = [];
      agent.routes = undefined;
      agent.turning = false;
      agent.reconsiderAt = this.elapsed + 2;
      state.moving = false;
      return;
    }
    const hopping =
      !backwards &&
      (style === "hop" || style === "climb") &&
      (leap ||
        (walks(state.surface) &&
          walks(target.surface) &&
          Math.min(state.normal.y, target.normal.y) >= 0.85)) &&
      this.graph.canTravel(from, target, agent.profile, true);
    if (!agent.edge) {
      const length = distance(state.position, target.position);
      agent.edge = {
        progress: 0,
        // Hops are bursts, independent of the slow cruising speed used to
        // crawl up stems. At normal simulation speed a hop lasts about 0.4s.
        duration: hopping
          ? (1.6 + Math.sqrt(length) * 1.3) * (0.9 + this.roll() * 0.2)
          : (length / agent.profile.speed) * (0.85 + this.roll() * 0.3),
        hop: hopping,
        backwards,
        lift: leap ? 0.2 : Math.min(0.16, 0.06 + length * 0.24),
      };
    }
    if (
      agent.edge.progress === 0 &&
      this.turnToward(
        agent,
        {
          x: state.position.x + wanted.x,
          y: state.position.y + wanted.y,
          z: state.position.z + wanted.z,
        },
        agent.hasTravelled && !hopping ? 0.65 : TURN_START,
        backwards,
      )
    )
      return;
    const edge = agent.edge;
    edge.progress = Math.min(
      1,
      edge.progress + STEP / Math.max(edge.duration, STEP),
    );
    const sign = edge.backwards ? -1 : 1;
    const length = Math.max(distance(from.position, target.position), 0.001);
    state.direction = {
      x: ((target.position.x - from.position.x) * sign) / length,
      y: ((target.position.y - from.position.y) * sign) / length,
      z: ((target.position.z - from.position.z) * sign) / length,
    };
    if (edge.progress >= 1 - 1e-9) {
      const pose = this.graph.place(
        target.position,
        target.normal,
        state.direction,
        target.surface,
        agent.profile,
        !!target.shelterId,
        target.supportId,
      );
      state.position = pose.position;
      state.normal = pose.normal;
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
    const pose = this.graph.pose(
      from,
      target,
      travel,
      agent.profile,
      edge.backwards,
    );
    state.position = pose.position;
    state.normal = pose.normal;
    state.grounded =
      !edge.hop && state.surface === "ground" && target.surface === "ground";

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
  private turnToward(
    agent: Agent,
    point: Vec3,
    threshold = TURN_START,
    backwards = false,
  ) {
    const state = agent.state;
    const facing = alongSurface(state.direction, state.normal);
    const sign = backwards ? -1 : 1;
    const wanted = alongSurface(
      {
        x: (point.x - state.position.x) * sign,
        y: (point.y - state.position.y) * sign,
        z: (point.z - state.position.z) * sign,
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
    if (
      wanted &&
      !agent.turning &&
      !this.graph.canTurn(
        this.graph.node(state.nodeId),
        state.direction,
        wanted,
        agent.profile,
      )
    ) {
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
    const pose = this.graph.place(
      this.graph.node(state.nodeId).position,
      this.graph.node(state.nodeId).normal,
      state.direction,
      state.surface,
      agent.profile,
      !!this.graph.node(state.nodeId).shelterId,
      this.graph.node(state.nodeId).supportId,
    );
    state.position = pose.position;
    state.normal = pose.normal;
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
