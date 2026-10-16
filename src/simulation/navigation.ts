import { finishWork } from "../work";
import type { HabitatNode, SpeciesProfile, Vec3 } from "./types";
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const copyVector = (v: Vec3): Vec3 => ({ ...v });
const RECENT_ROUTES = 8;

export interface HabitatRoutes {
  distances: ReadonlyMap<string, number>;
  costs: ReadonlyMap<string, number>;
  firstSteps: ReadonlyMap<string, string>;
  pathTo(target: string): string[];
}

type TravelCost = (
  from: HabitatNode,
  to: HabitatNode,
  species: SpeciesProfile,
) => number;

/** Explicit connected surfaces prevent animals walking through ponds or across empty air. */
export class HabitatGraph {
  readonly nodes: ReadonlyMap<string, HabitatNode>;
  private readonly edgeCosts = new WeakMap<
    SpeciesProfile,
    Map<HabitatNode, Map<HabitatNode, number>>
  >();
  private readonly recentRoutes = new WeakMap<
    SpeciesProfile,
    Map<string, HabitatRoutes>
  >();
  constructor(
    nodes: readonly HabitatNode[],
    private readonly travelCost?: TravelCost,
    prepared = finishWork(copyNodes(nodes)),
  ) {
    this.nodes = prepared;
  }
  static *build(
    nodes: readonly HabitatNode[],
    travelCost?: TravelCost,
  ): Generator<void, HabitatGraph> {
    return new HabitatGraph(nodes, travelCost, yield* copyNodes(nodes));
  }
  node(id: string): HabitatNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Unknown habitat node: ${id}`);
    return node;
  }
  allowed(id: string, species: SpeciesProfile) {
    const node = this.node(id);
    const swims = species.swims;
    if (node.swim)
      // Shallow water still lets a fish reach the bottom.
      return (
        !!swims &&
        node.swim.room >= swims.room &&
        node.swim.column >= swims.height &&
        node.swim.depth <= swims.depth[1] &&
        (node.swim.depth >= swims.depth[0] || node.swim.bottom)
      );
    if (swims) return false;
    if ((node.room ?? Infinity) < (species.radius ?? 0)) return false;
    if (
      (node.headroom ?? Infinity) < (species.body?.height ?? 0) ||
      (node.width ?? Infinity) < (species.body?.width ?? 0) ||
      (node.surface === "leaf" &&
        (node.supportWidth ?? Infinity) < (species.body?.width ?? 0) * 0.5)
    )
      return false;
    if (node.submerged ? !species.water : species.water === "lives")
      return false;
    if (node.surface === "ground") return true;
    // Gently sloping bark is walkable by any frog; steeper bark needs a climber.
    const walkable =
      ["bark", "stone", "plant"].includes(node.surface) && node.normal.y >= 0.7;
    if (!walkable && !species.climbs) return false;
    return (
      node.perchHeight === undefined ||
      node.perchHeight <= (species.maxPerchHeight ?? Infinity)
    );
  }
  canRest(id: string, species: SpeciesProfile) {
    const node = this.node(id);
    return (
      node.surface !== "stem" &&
      (node.supportWidth ?? Infinity) >= (species.body?.width ?? 0) * 0.5
    );
  }
  nearest(position: Vec3, species: SpeciesProfile) {
    let best: HabitatNode | undefined,
      bestDistance = Infinity;
    for (const node of this.nodes.values()) {
      const d = distance(position, node.position);
      if (
        d < bestDistance &&
        this.canRest(node.id, species) &&
        this.allowed(node.id, species)
      ) {
        best = node;
        bestDistance = d;
      }
    }
    return best;
  }
  /** Every route search prices the whole graph, so each edge is priced
   * once per species and remembered for the life of the graph. */
  edgeCost(from: HabitatNode, to: HabitatNode, species: SpeciesProfile) {
    let costs = this.edgeCosts.get(species);
    if (!costs) this.edgeCosts.set(species, (costs = new Map()));
    let fromCosts = costs.get(from);
    if (!fromCosts) costs.set(from, (fromCosts = new Map()));
    let cost = fromCosts.get(to);
    if (cost === undefined) {
      cost =
        this.travelCost?.(from, to, species) ??
        distance(from.position, to.position);
      fromCosts.set(to, cost);
    }
    return cost;
  }
  /** Prefer short, open routes. Physical distance is tracked separately
   * from foliage cost so needs and travel time still use actual distance. */
  routes(start: string, species: SpeciesProfile): HabitatRoutes {
    return finishWork(this.searchRoutes(start, species));
  }
  /** Animals keep returning to the same few spots, and a search from one
   * never changes while the graph lives, so recent ones are kept. */
  *searchRoutes(
    start: string,
    species: SpeciesProfile,
  ): Generator<void, HabitatRoutes> {
    let recent = this.recentRoutes.get(species);
    if (!recent) this.recentRoutes.set(species, (recent = new Map()));
    let routes = recent.get(start);
    if (routes) recent.delete(start);
    else routes = yield* this.search(start, species);
    recent.set(start, routes);
    if (recent.size > RECENT_ROUTES) recent.delete(recent.keys().next().value!);
    return routes;
  }
  private *search(
    start: string,
    species: SpeciesProfile,
  ): Generator<void, HabitatRoutes> {
    const parents = new Map<string, string>();
    const firstSteps = new Map<string, string>();
    const distances = new Map<string, number>([[start, 0]]);
    const costs = new Map<string, number>([[start, 0]]);
    const queue = [{ id: start, distance: 0 }];
    const enqueue = (entry: { id: string; distance: number }) => {
      let index = queue.length;
      queue.push(entry);
      while (index > 0) {
        const parent = (index - 1) >>> 1;
        if (queue[parent].distance <= entry.distance) break;
        queue[index] = queue[parent];
        index = parent;
      }
      queue[index] = entry;
    };
    const dequeue = () => {
      const first = queue[0],
        last = queue.pop()!;
      if (queue.length) {
        let index = 0;
        while (index * 2 + 1 < queue.length) {
          let child = index * 2 + 1;
          if (
            child + 1 < queue.length &&
            queue[child + 1].distance < queue[child].distance
          )
            child++;
          if (last.distance <= queue[child].distance) break;
          queue[index] = queue[child];
          index = child;
        }
        queue[index] = last;
      }
      return first;
    };
    let visited = 0;
    while (queue.length) {
      if (visited++ % 8 === 0) yield;
      const current = dequeue();
      if (current.distance !== costs.get(current.id)) continue;
      const from = this.node(current.id);
      const steps =
        from.leaps &&
        (species.movement === "hop" || species.movement === "climb")
          ? from.neighbors.concat(from.leaps)
          : from.neighbors;
      for (const next of steps) {
        if (!this.allowed(next, species)) continue;
        const to = this.node(next);
        if (
          from.surface === "leaf" &&
          to.surface === "leaf" &&
          species.movement !== "climb"
        )
          continue;
        if (
          !species.climbs &&
          (["stone", "plant"].includes(from.surface) ||
            ["stone", "plant"].includes(to.surface)) &&
          Math.abs(from.position.y - to.position.y) >
            Math.hypot(
              from.position.x - to.position.x,
              from.position.z - to.position.z,
            ) *
              0.8
        )
          continue;
        const cost = current.distance + this.edgeCost(from, to, species);
        if (cost >= (costs.get(next) ?? Infinity)) continue;
        costs.set(next, cost);
        distances.set(
          next,
          distances.get(current.id)! + distance(from.position, to.position),
        );
        parents.set(next, current.id);
        firstSteps.set(
          next,
          current.id === start ? next : firstSteps.get(current.id)!,
        );
        enqueue({ id: next, distance: cost });
      }
    }
    return {
      distances,
      costs,
      firstSteps,
      // Decisions need distances to all reachable surfaces but only one
      // actual route. Avoid allocating thousands of unused path arrays.
      pathTo(target: string) {
        if (!distances.has(target))
          throw new Error(`Unreachable habitat node: ${target}`);
        const path: string[] = [];
        for (let next = target; next !== start; next = parents.get(next)!)
          path.push(next);
        return path.reverse();
      },
    };
  }
  paths(start: string, species: SpeciesProfile): Map<string, string[]> {
    const routes = this.routes(start, species);
    return new Map(
      [...routes.distances.keys()].map((id) => [id, routes.pathTo(id)]),
    );
  }
}

function* copyNodes(
  nodes: readonly HabitatNode[],
): Generator<void, Map<string, HabitatNode>> {
  const map = new Map<string, HabitatNode>();
  for (const node of nodes) {
    yield;
    if (map.has(node.id)) throw new Error(`Duplicate habitat node: ${node.id}`);
    if (
      ![
        ...Object.values(node.position),
        ...Object.values(node.normal),
        node.shelter,
      ].every(Number.isFinite)
    )
      throw new Error("Habitat geometry must be finite.");
    if (Math.hypot(node.normal.x, node.normal.y, node.normal.z) < 0.001)
      throw new Error("A surface needs a normal.");
    map.set(node.id, {
      ...node,
      position: { ...node.position },
      normal: { ...node.normal },
      neighbors: [...node.neighbors],
      leaps: node.leaps && [...node.leaps],
    });
  }
  for (const node of map.values()) {
    yield;
    for (const id of [...node.neighbors, ...(node.leaps ?? [])])
      if (!map.has(id)) throw new Error(`Missing neighbor: ${id}`);
  }
  return map;
}
