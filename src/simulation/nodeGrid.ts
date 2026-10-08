import type { HabitatNode, Vec3 } from "./types";

/** Broad-phase candidates in the original graph order, so equal routes keep
 * their existing tie breaks. Exact distances are checked by the caller. */
export class HabitatNodeGrid {
  private readonly cells = new Map<
    string,
    { node: HabitatNode; order: number }[]
  >();

  constructor(
    nodes: readonly HabitatNode[],
    private readonly size: number,
  ) {
    nodes.forEach((node, order) => {
      const key = `${Math.floor(node.position.x / size)}:${Math.floor(node.position.z / size)}`;
      const cell = this.cells.get(key);
      if (cell) cell.push({ node, order });
      else this.cells.set(key, [{ node, order }]);
    });
  }

  near(point: Vec3, range: number): HabitatNode[] {
    const candidates: { node: HabitatNode; order: number }[] = [];
    const minX = Math.floor((point.x - range) / this.size);
    const maxX = Math.floor((point.x + range) / this.size);
    const minZ = Math.floor((point.z - range) / this.size);
    const maxZ = Math.floor((point.z + range) / this.size);
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++)
        candidates.push(...(this.cells.get(`${x}:${z}`) ?? []));
    return candidates.sort((a, b) => a.order - b.order).map(({ node }) => node);
  }
}
