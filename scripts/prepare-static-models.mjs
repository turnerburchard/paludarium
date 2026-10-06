/** Bake downloaded static models into face lists grouped by color, so asset
 * factories can build them synchronously and recolor them by role.
 * Sources are listed in docs/inspiration/ASSET-SOURCES.md.
 * Run from the repository root: node scripts/prepare-static-models.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Box3, Mesh, Vector3 } from "three";
import { loadGlb, palette } from "./glb.mjs";

const MODELS = [
  {
    // "Cattail" by Poly by Google, poly.pizza/m/9uT74BMpRrl, CC-BY 3.0.
    source: "docs/inspiration/models/cattail-poly-google.glb",
    out: "src/assets/plants/cattail.json",
    height: 1.15,
  },
  {
    // "Snail" by Poly by Google, poly.pizza/m/aZ_cT-AIu2y, CC-BY 3.0.
    // Its head points +Z; animals in the habitat face -Z.
    source: "docs/inspiration/models/snail-poly-google.glb",
    out: "src/assets/animals/snail.json",
    length: 0.24,
    turn: true,
  },
];

for (const model of MODELS) {
  const { gltf, images } = await loadGlb(readFileSync(model.source));
  const color = images[0] && palette(images[0]);
  const bounds = new Box3().setFromObject(gltf.scene);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const scale = model.height ? model.height / size.y : model.length / size.z;
  const flip = model.turn ? -1 : 1;
  const parts = new Map();
  gltf.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry.toNonIndexed();
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < position.count; i += 3) {
      // A face takes its texture's palette color, or its material's.
      const key = color
        ? color(uv.getX(i), uv.getY(i)).toString(16).padStart(6, "0")
        : [object.material].flat()[0].color.getHexString();
      const part = parts.get(key) ?? { color: key, positions: [] };
      for (let k = 0; k < 3; k++) {
        const p = new Vector3()
          .fromBufferAttribute(position, i + k)
          .applyMatrix4(object.matrixWorld);
        part.positions.push(
          ...[
            flip * (p.x - center.x) * scale,
            (p.y - bounds.min.y) * scale,
            flip * (p.z - center.z) * scale,
          ].map((v) => Number(v.toFixed(5))),
        );
      }
      parts.set(key, part);
    }
  });
  writeFileSync(model.out, JSON.stringify({ parts: [...parts.values()] }));
  console.log(
    `${model.out}: ${[...parts.values()].reduce((n, p) => n + p.positions.length / 9, 0)} triangles in ${parts.size} colors`,
  );
}
