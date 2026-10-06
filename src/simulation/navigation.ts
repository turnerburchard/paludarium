import type { HabitatNode, SpeciesProfile, Vec3 } from "./types";
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const copyVector = (v: Vec3): Vec3 => ({ ...v });

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
      map.set(node.id, structuredClone(node));
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
    if (node.surface === "ground") return true;
    if (!species.climbs) return false;
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
  /** One traversal per decision gives both reachable destinations and their paths. */
  paths(start: string, species: SpeciesProfile): Map<string, string[]> {
    const paths = new Map<string, string[]>([[start, []]]),
      queue = [start];
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      for (const next of this.node(id).neighbors) {
        if (paths.has(next) || !this.allowed(next, species)) continue;
        if (
          this.node(id).surface === "leaf" &&
          this.node(next).surface === "leaf" &&
          species.movement !== "climb"
        )
          continue;
        paths.set(next, [...paths.get(id)!, next]);
        queue.push(next);
      }
    }
    return paths;
  }
}
