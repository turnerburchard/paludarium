/** Bake CC0 Quaternius rocks and cacti into synchronous asset geometry, one
 * part per source material so each keeps its color.
 * Download sources and licenses live in docs/inspiration/models/quaternius-*.
 * Run from the repository root: node scripts/prepare-quaternius-stones.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Box3, Color, Mesh, Vector3 } from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const nature = "docs/inspiration/models/quaternius-nature";
const crops = "docs/inspiration/models/quaternius-crops";
const stones = "src/assets/landscape";
const plants = "src/assets/plants";

// Rocks are sized by their footprint, cacti by their height.
for (const { source, out, width, height } of [
  { source: `${nature}/Rock_1`, out: `${stones}/quaterniusBoulder`, width: 0.8 },
  { source: `${nature}/Rock_4`, out: `${stones}/quaterniusOutcrop`, width: 1 },
  { source: `${nature}/Rock_6`, out: `${stones}/quaterniusCrag`, width: 0.7 },
  { source: `${nature}/Rock_2`, out: `${stones}/quaterniusWedge`, width: 0.65 },
  { source: `${nature}/Rock_3`, out: `${stones}/quaterniusDome`, width: 0.8 },
  { source: `${nature}/Rock_5`, out: `${stones}/quaterniusBlock`, width: 0.75 },
  { source: `${nature}/Rock_7`, out: `${stones}/quaterniusLedge`, width: 0.9 },
  { source: `${nature}/CactusFlowers_2`, out: `${plants}/saguaro`, height: 1.1 },
  { source: `${nature}/CactusFlowers_3`, out: `${plants}/organPipe`, height: 0.8 },
  { source: `${nature}/CactusFlowers_4`, out: `${plants}/beavertail`, height: 0.6 },
  { source: `${crops}/Cactus_4`, out: `${plants}/cholla`, height: 0.6 },
]) {
  const model = new OBJLoader().parse(readFileSync(`${source}.obj`, "utf8"));
  const bounds = new Box3().setFromObject(model);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const scale = width ? width / Math.max(size.x, size.z) : height / size.y;
  const colors = materialColors(readFileSync(`${source}.mtl`, "utf8"));
  const parts = new Map();
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const vertices = object.geometry.getAttribute("position");
    const materials = [object.material].flat();
    const groups = object.geometry.groups.length
      ? object.geometry.groups
      : [{ start: 0, count: vertices.count, materialIndex: 0 }];
    for (const { start, count, materialIndex } of groups) {
      const color = colors[materials[materialIndex].name];
      if (!parts.has(color)) parts.set(color, []);
      const positions = parts.get(color);
      for (let i = start; i < start + count; i++) {
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
    }
  });
  writeFileSync(
    `${out}.json`,
    JSON.stringify({
      parts: [...parts].map(([color, positions]) => ({ color, positions })),
    }) + "\n",
  );
}

/** Each material's diffuse color, as an sRGB hex string. */
function materialColors(mtl) {
  const colors = {};
  for (const block of mtl.split("newmtl ").slice(1)) {
    const name = block.split("\n")[0].trim();
    const diffuse = block.match(/^Kd (.+)$/m)[1].split(" ").map(Number);
    colors[name] = `#${new Color(...diffuse).getHexString()}`;
  }
  return colors;
}
