/** Bake the CC0 Ultimate Nature Pack rocks into synchronous asset geometry.
 * Download sources and license live in docs/inspiration/models/quaternius-nature.
 * Run from the repository root: node scripts/prepare-quaternius-stones.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Box3, Color, Mesh, Vector3 } from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

for (const [source, name, width] of [
  ["Rock_1", "quaterniusBoulder", 0.8],
  ["Rock_4", "quaterniusOutcrop", 1],
  ["Rock_6", "quaterniusCrag", 0.7],
]) {
  const path = `docs/inspiration/models/quaternius-nature/${source}`;
  const model = new OBJLoader().parse(readFileSync(`${path}.obj`, "utf8"));
  const bounds = new Box3().setFromObject(model);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const scale = width / Math.max(size.x, size.z);
  const diffuse = readFileSync(`${path}.mtl`, "utf8")
    .match(/^Kd (.+)$/m)[1]
    .split(" ")
    .map(Number);
  const color = `#${new Color(...diffuse).getHexString()}`;
  const positions = [];
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const vertices = object.geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const vertex = new Vector3().fromBufferAttribute(vertices, i);
      vertex.applyMatrix4(object.matrixWorld);
      positions.push(
        ...[
          (vertex.x - center.x) * scale,
          (vertex.y - bounds.min.y) * scale,
          (vertex.z - center.z) * scale,
        ].map((value) => Number(value.toFixed(5))),
      );
    }
  });
  writeFileSync(
    `src/assets/landscape/${name}.json`,
    JSON.stringify({ parts: [{ color, positions }] }) + "\n",
  );
}
