import type { HabitatNode, SpeciesProfile, Vec3 } from "./types";
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const copyVector = (v: Vec3): Vec3 => ({ ...v });

export interface HabitatRoutes {
  distances: ReadonlyMap<string, number>;
  firstSteps: ReadonlyMap<string, string>;
  pathTo(target: string): string[];
}

/** Explicit connected surfaces prevent animals walking through ponds or across empty air. */
export class HabitatGraph {
  readonly nodes: ReadonlyMap<string, HabitatNode>;
  constructor(nodes: readonly HabitatNode[]) {
    const map = new Map<string, HabitatNode>();
    for (const node of nodes) {
      if (map.has(node.id))
        throw new Error(`Duplicate habitat node: ${node.id}`);
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
      });
    }
    for (const node of map.values())
      for (const id of node.neighbors)
        if (!map.has(id)) throw new Error(`Missing neighbor: ${id}`);
    this.nodes = map;
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
        node.swim.depth <= swims.depth[1] &&
        (node.swim.depth >= swims.depth[0] || node.swim.bottom)
      );
    if (swims) return false;
    if ((node.room ?? Infinity) < (species.radius ?? 0)) return false;
    if (node.submerged ? !species.water : species.water === "lives")
      return false;
    if (node.surface === "ground") return true;
    // Gently sloping bark is walkable by any frog; steeper bark needs a climber.
    const walkable =
      (node.surface === "bark" || node.surface === "stone") &&
      node.normal.y >= 0.7;
    if (!walkable && !species.climbs) return false;
    return (
      node.perchHeight === undefined ||
      node.perchHeight <= (species.maxPerchHeight ?? Infinity)
    );
  }
  nearest(position: Vec3, species: SpeciesProfile) {
    let best: HabitatNode | undefined,
      bestDistance = Infinity;
    for (const node of this.nodes.values()) {
      const d = distance(position, node.position);
      if (this.allowed(node.id, species) && d < bestDistance) {
        best = node;
        bestDistance = d;
      }
    }
    return best;
  }
  /** Shortest physical routes, rather than the fewest grid cells. A fine
   * stone mesh must not make a nearby ledge seem farther away than a wall. */
  routes(start: string, species: SpeciesProfile): HabitatRoutes {
    const parents = new Map<string, string>();
    const firstSteps = new Map<string, string>();
    const distances = new Map<string, number>([[start, 0]]);
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
    while (queue.length) {
      const current = dequeue();
      if (current.distance !== distances.get(current.id)) continue;
      const from = this.node(current.id);
      for (const next of from.neighbors) {
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
          (from.surface === "stone" || to.surface === "stone") &&
          Math.abs(from.position.y - to.position.y) >
            Math.hypot(
              from.position.x - to.position.x,
              from.position.z - to.position.z,
            ) *
              0.8
        )
          continue;
        const length = current.distance + distance(from.position, to.position);
        if (length >= (distances.get(next) ?? Infinity)) continue;
        distances.set(next, length);
        parents.set(next, current.id);
        firstSteps.set(
          next,
          current.id === start ? next : firstSteps.get(current.id)!,
        );
        enqueue({ id: next, distance: length });
      }
    }
    return {
      distances,
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
