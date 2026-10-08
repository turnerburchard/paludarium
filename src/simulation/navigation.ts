import type { BodyBounds, HabitatNode, SpeciesProfile, Vec3 } from "./types";
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const copyVector = (v: Vec3): Vec3 => ({ ...v });

/** Geometry stays outside the decision engine; routes and rendering use the same contact. */
export interface HabitatGeometry {
  groundPose(
    position: Vec3,
    direction: Vec3,
    body: BodyBounds,
  ): { position: Vec3; normal: Vec3 };
  aboveGround(
    position: Vec3,
    normal: Vec3,
    direction: Vec3,
    body: BodyBounds,
  ): { position: Vec3; normal: Vec3 };
  onSurface?(
    position: Vec3,
    normal: Vec3,
    direction: Vec3,
    body: BodyBounds,
    supportIds: readonly string[],
  ): { position: Vec3; normal: Vec3 };
  fits(
    position: Vec3,
    normal: Vec3,
    direction: Vec3,
    body: BodyBounds,
    tilt?: number,
  ): boolean;
}

export interface HabitatRoutes {
  distances: ReadonlyMap<string, number>;
  firstSteps: ReadonlyMap<string, string>;
  pathTo(target: string): string[];
}

/** Explicit connected surfaces prevent animals walking through ponds or across empty air. */
export class HabitatGraph {
  readonly nodes: ReadonlyMap<string, HabitatNode>;
  private readonly edgeClearance = new WeakMap<
    BodyBounds,
    Map<string, { clear: boolean; poses: { position: Vec3; normal: Vec3 }[] }>
  >();
  private readonly turnClearance = new WeakMap<
    BodyBounds,
    Map<string, boolean>
  >();
  private readonly clearance = new WeakMap<
    BodyBounds,
    Map<string, Vec3 | null>
  >();
  constructor(
    nodes: readonly HabitatNode[],
    private readonly geometry?: HabitatGeometry,
  ) {
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
    if (node.submerged ? !species.water : species.water === "lives") return false;
    if (species.body && this.geometry) {
      let cache = this.clearance.get(species.body!);
      if (!cache) this.clearance.set(species.body, (cache = new Map()));
      const cached = cache.get(id);
      if (cached === null) return false;
      if (cached === undefined) {
        // A narrow surface can fit one heading even when there is no room to turn.
        let fits = false;
        let heading: Vec3 | null = null;
        for (let i = 0; i < 8 && !fits; i++) {
          const angle = (i * Math.PI) / 4;
          let tangent = { x: 0, y: 0, z: -1 };
          const dot = -node.normal.z;
          tangent = {
            x: tangent.x - node.normal.x * dot,
            y: tangent.y - node.normal.y * dot,
            z: tangent.z - node.normal.z * dot,
          };
          let length = Math.hypot(tangent.x, tangent.y, tangent.z);
          if (length < 0.001) {
            tangent = { x: 0, y: 1, z: 0 };
            length = 1;
          }
          tangent = {
            x: tangent.x / length,
            y: tangent.y / length,
            z: tangent.z / length,
          };
          const side = {
            x: node.normal.y * tangent.z - node.normal.z * tangent.y,
            y: node.normal.z * tangent.x - node.normal.x * tangent.z,
            z: node.normal.x * tangent.y - node.normal.y * tangent.x,
          };
          const direction = {
            x: tangent.x * Math.cos(angle) + side.x * Math.sin(angle),
            y: tangent.y * Math.cos(angle) + side.y * Math.sin(angle),
            z: tangent.z * Math.cos(angle) + side.z * Math.sin(angle),
          };
          const pose = this.place(
            node.position,
            node.normal,
            direction,
            node.surface,
            species,
            !!node.shelterId,
            node.supportId,
          );
          fits = this.geometry.fits(
            pose.position,
            pose.normal,
            direction,
            species.body,
          );
          if (fits) heading = direction;
        }
        cache.set(id, heading);
        if (!fits) return false;
      }
    }
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
  startingDirection(
    node: HabitatNode,
    species: SpeciesProfile,
    preferred: Vec3,
  ) {
    if (!species.body || !this.geometry) return preferred;
    const pose = this.place(
      node.position,
      node.normal,
      preferred,
      node.surface,
      species,
      !!node.shelterId,
      node.supportId,
    );
    if (this.geometry.fits(pose.position, pose.normal, preferred, species.body))
      return preferred;
    const heading = this.clearance.get(species.body!)?.get(node.id);
    if (!heading) throw new Error("Starting surface has no clear heading.");
    return { ...heading };
  }

  place(
    position: Vec3,
    normal: Vec3,
    direction: Vec3,
    surface: HabitatNode["surface"],
    species: SpeciesProfile,
    shelter = false,
    supportId?: string,
  ) {
    if (surface === "ground" && species.body && this.geometry) {
      if (shelter)
        return this.geometry.aboveGround(
          position,
          normal,
          direction,
          species.body,
        );
      return this.geometry.groundPose(position, direction, species.body);
    }
    if (supportId && species.body && this.geometry?.onSurface) {
      const contact = this.geometry.onSurface(
        position,
        normal,
        direction,
        species.body,
        [supportId],
      );
      return this.geometry.aboveGround(
        contact.position,
        contact.normal,
        direction,
        species.body,
      );
    }
    return { position: copyVector(position), normal: copyVector(normal) };
  }

  pose(
    from: HabitatNode,
    to: HabitatNode,
    progress: number,
    species: SpeciesProfile,
    backwards = false,
  ) {
    const cached =
      species.body &&
      this.edgeClearance
        .get(species.body)
        ?.get(`${from.id}>${to.id}:false:${backwards}`);
    if (
      cached &&
      cached.clear &&
      (from.surface !== "ground" || to.surface !== "ground")
    ) {
      const index = progress * (cached.poses.length - 1);
      const a = cached.poses[Math.floor(index)],
        b = cached.poses[Math.ceil(index)];
      const t = index - Math.floor(index);
      const mix = (left: Vec3, right: Vec3) => ({
        x: left.x + (right.x - left.x) * t,
        y: left.y + (right.y - left.y) * t,
        z: left.z + (right.z - left.z) * t,
      });
      const normal = mix(a.normal, b.normal);
      const length = Math.hypot(normal.x, normal.y, normal.z);
      return {
        position: mix(a.position, b.position),
        normal: length > 0.001 ? {
          x: normal.x / length,
          y: normal.y / length,
          z: normal.z / length,
        } : {...b.normal},
      };
    }
    const position = {
      x: from.position.x + (to.position.x - from.position.x) * progress,
      y: from.position.y + (to.position.y - from.position.y) * progress,
      z: from.position.z + (to.position.z - from.position.z) * progress,
    };
    const sign = backwards ? -1 : 1;
    const direction = {
      x: (to.position.x - from.position.x) * sign,
      y: (to.position.y - from.position.y) * sign,
      z: (to.position.z - from.position.z) * sign,
    };
    if (progress === 0 || progress === 1) {
      const node = progress === 0 ? from : to;
      return this.place(
        node.position,
        node.normal,
        direction,
        node.surface,
        species,
        !!node.shelterId,
        node.supportId,
      );
    }
    const normal = {
      x: from.normal.x + (to.normal.x - from.normal.x) * progress,
      y: from.normal.y + (to.normal.y - from.normal.y) * progress,
      z: from.normal.z + (to.normal.z - from.normal.z) * progress,
    };
    const length = Math.hypot(normal.x, normal.y, normal.z);
    const up =
      length > 0.001
        ? { x: normal.x / length, y: normal.y / length, z: normal.z / length }
        : to.normal;
    if (from.surface === "ground" && to.surface === "ground")
      return this.place(
        position,
        up,
        direction,
        "ground",
        species,
        !!(from.shelterId || to.shelterId),
      );
    const supportIds = [from.supportId, to.supportId].filter(
      (id) => id !== undefined,
    );
    if (
      species.body &&
      this.geometry &&
      (supportIds.length ||
        from.surface === "ground" ||
        to.surface === "ground")
    ) {
      const contact =
        supportIds.length && this.geometry.onSurface
          ? this.geometry.onSurface(
              position,
              up,
              direction,
              species.body,
              supportIds,
            )
          : { position, normal: up };
      return this.geometry.aboveGround(
        contact.position,
        contact.normal,
        direction,
        species.body,
      );
    }
    return { position, normal: up };
  }

  canTravel(
    from: HabitatNode,
    to: HabitatNode,
    species: SpeciesProfile,
    hop = false,
    backwards = false,
  ) {
    if (!species.body || !this.geometry) return true;
    let cache = this.edgeClearance.get(species.body);
    if (!cache) this.edgeClearance.set(species.body, (cache = new Map()));
    const key = `${from.id}>${to.id}:${hop}:${backwards}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached.clear;
    const length = distance(from.position, to.position);
    const lift =
      from.surface === "leaf" && to.surface === "leaf"
        ? 0.2
        : Math.min(0.16, 0.06 + length * 0.24);
    const steps = Math.max(2, Math.ceil(length / 0.025), hop ? 16 : 0);
    const sign = backwards ? -1 : 1;
    const direction = {
      x: (to.position.x - from.position.x) * sign,
      y: (to.position.y - from.position.y) * sign,
      z: (to.position.z - from.position.z) * sign,
    };
    const poses: { position: Vec3; normal: Vec3 }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pose = this.pose(from, to, t, species, backwards);
      poses.push({
        position: { ...pose.position },
        normal: { ...pose.normal },
      });
      if (hop) pose.position.y += 4 * t * (1 - t) * lift;
      if (
        !this.geometry.fits(
          pose.position,
          pose.normal,
          direction,
          species.body,
          hop ? Math.sin(t * Math.PI * 2) * 0.13 : 0,
        )
      ) {
        cache.set(key, { clear: false, poses: [] });
        return false;
      }
    }
    cache.set(key, { clear: true, poses });
    return true;
  }

  canTurn(
    node: HabitatNode,
    facing: Vec3,
    wanted: Vec3,
    species: SpeciesProfile,
  ) {
    if (!species.body || !this.geometry) return true;
    let cache = this.turnClearance.get(species.body);
    if (!cache) this.turnClearance.set(species.body, (cache = new Map()));
    const normal = node.normal;
    const project = (value: Vec3) => {
      const size = Math.hypot(value.x, value.y, value.z);
      if (size < 1e-9) return undefined;
      const v = { x: value.x / size, y: value.y / size, z: value.z / size };
      const dot = v.x * normal.x + v.y * normal.y + v.z * normal.z;
      const tangent = {
        x: v.x - normal.x * dot,
        y: v.y - normal.y * dot,
        z: v.z - normal.z * dot,
      };
      const length = Math.hypot(tangent.x, tangent.y, tangent.z);
      return length > 0.001
        ? {
            x: tangent.x / length,
            y: tangent.y / length,
            z: tangent.z / length,
          }
        : undefined;
    };
    const from = project(facing),
      to = project(wanted);
    if (!from || !to) return true;
    const key = `${node.id}:${[from.x, from.y, from.z, to.x, to.y, to.z].map((value) => value.toFixed(8)).join(",")}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const cosine = from.x * to.x + from.y * to.y + from.z * to.z;
    const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
    const across = {
      x: normal.y * from.z - normal.z * from.y,
      y: normal.z * from.x - normal.x * from.z,
      z: normal.x * from.y - normal.y * from.x,
    };
    const sign =
      across.x * to.x + across.y * to.y + across.z * to.z < 0 ? -1 : 1;
    const steps = Math.max(1, Math.ceil(angle / 0.1));
    for (let i = 0; i <= steps; i++) {
      const turn = (angle * sign * i) / steps;
      const direction = {
        x: from.x * Math.cos(turn) + across.x * Math.sin(turn),
        y: from.y * Math.cos(turn) + across.y * Math.sin(turn),
        z: from.z * Math.cos(turn) + across.z * Math.sin(turn),
      };
      const pose = this.place(
        node.position,
        normal,
        direction,
        node.surface,
        species,
        !!node.shelterId,
        node.supportId,
      );
      if (
        !this.geometry.fits(pose.position, pose.normal, direction, species.body)
      ) {
        cache.set(key, false);
        return false;
      }
    }
    cache.set(key, true);
    return true;
  }

  private canStep(from: HabitatNode, to: HabitatNode, species: SpeciesProfile) {
    if (!this.allowed(to.id, species)) return false;
    if (
      from.surface === "leaf" &&
      to.surface === "leaf" &&
      species.movement !== "climb"
    )
      return false;
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
      return false;
    const leap = from.surface === "leaf" && to.surface === "leaf";
    if (
      !this.canTravel(from, to, species, leap) &&
      (leap || !this.canTravel(from, to, species, false, true))
    )
      return false;
    return true;
  }

  nearest(position: Vec3, species: SpeciesProfile) {
    const candidates = [...this.nodes.values()].sort(
      (a, b) => distance(position, a.position) - distance(position, b.position),
    );
    const isolated = new Set<string>();
    for (const node of candidates) {
      if (isolated.has(node.id) || !this.allowed(node.id, species)) continue;
      if (!species.body || !this.geometry || (node.surface === "ground" && !node.shelterId))
        return node;
      const reached = new Set([node.id]);
      const queue = [node];
      for (let i = 0; i < queue.length; i++) {
        const from = queue[i];
        if (from.surface === "ground" && !from.shelterId) return node;
        for (const id of from.neighbors) {
          if (reached.has(id)) continue;
          const to = this.node(id);
          if (!this.canStep(from, to, species)) continue;
          reached.add(id);
          queue.push(to);
        }
      }
      for (const id of reached) isolated.add(id);
    }
    return undefined;
  }
  /** Shortest physical routes, rather than the fewest grid cells. A fine
   * stone mesh must not make a nearby ledge seem farther away than a wall. */
  routes(
    start: string,
    species: SpeciesProfile,
    blocked?: ReadonlyMap<string, ReadonlySet<string>>,
  ): HabitatRoutes {
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
        if (blocked?.get(current.id)?.has(next)) continue;
        const to = this.node(next);
        if (!this.canStep(from, to, species)) continue;
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
