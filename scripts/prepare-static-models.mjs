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
  {
    // "Flower Pot" by Zsky, poly.pizza/m/Kgt363WkKd, CC-BY 3.0; the pot is left out.
    source: "docs/inspiration/models/alocasia-zsky.glb",
    out: "src/assets/plants/alocasia.json",
    skip: ["VaseFlowerPot4", "GroundFlowerPot4"],
    height: 0.95,
  },
  {
    // "Houseplant" by Quaternius, poly.pizza/m/bfLOqIV5uP, CC0; the pot is left out.
    source: "docs/inspiration/models/houseplant-quaternius.glb",
    out: "src/assets/plants/treePhilodendron.json",
    skip: ["Black", "Brown"],
    height: 0.8,
  },
  {
    // "Grass" by Quaternius, poly.pizza/m/UGTOzcO3P2, CC0; the larger clump.
    source: "docs/inspiration/models/grass-quaternius.glb",
    out: "src/assets/plants/hairgrass.json",
    skip: ["Grass_Small"],
    height: 0.42,
    roles: { dark: "2e4312", mid: "4f631f", light: "7a8e2e" },
  },
  {
    // "Flowers" by CreativeTrio, poly.pizza/m/RP8p3h7JHJ, CC0.
    source: "docs/inspiration/models/flowers-creativetrio.glb",
    out: "src/assets/plants/orchid.json",
    height: 0.6,
  },
  {
    // "Lily pad" by Poly by Google, poly.pizza/m/0-_GjMekeob, CC-BY 3.0.
    source: "docs/inspiration/models/lilypad-poly-google.glb",
    out: "src/assets/plants/waterLily.json",
    width: 0.55,
    roles: {
      pad: "46ab72",
      padShade: "265e3e",
      petal: "b16a83",
      petalLight: "d59da5",
      petalDark: "5a2839",
      deep: "271218",
    },
  },
  {
    // "Cactus" by Poly by Google, poly.pizza/m/9UCcl_W0Xq3, CC-BY 3.0.
    source: "docs/inspiration/models/cactus-poly-google.glb",
    out: "src/assets/plants/hedgehogCactus.json",
    height: 0.42,
    roles: {
      body: "6f7d27",
      shade: "253201",
      spine: "4bac0d",
      center: "ffdb47",
      petal: "f36aa7",
      petalDark: "b55084",
    },
  },
];

for (const model of MODELS) {
  const { gltf, images } = await loadGlb(readFileSync(model.source));
  const color = images[0] && palette(images[0]);
  const roles = model.roles && Object.entries(model.roles);
  // Gather each kept face's world corners and source color, leaving out
  // skipped materials such as a plant's pot.
  const faces = [];
  gltf.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const material = [object.material].flat()[0];
    if (model.skip?.some((name) => [object.name, material.name].includes(name)))
      return;
    const geometry = object.geometry.toNonIndexed();
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < position.count; i += 3) {
      // A face takes its texture's palette color, or its material's.
      const source = color
        ? color(uv.getX(i), uv.getY(i)).toString(16).padStart(6, "0")
        : material.color.getHexString();
      faces.push({
        key: roles ? nearestRole(source, roles) : source,
        corners: [0, 1, 2].map((k) =>
          new Vector3()
            .fromBufferAttribute(position, i + k)
            .applyMatrix4(object.matrixWorld),
        ),
      });
    }
  });
  const bounds = new Box3();
  for (const face of faces)
    for (const corner of face.corners) bounds.expandByPoint(corner);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const scale = model.height
    ? model.height / size.y
    : model.width
      ? model.width / Math.max(size.x, size.z)
      : model.length / size.z;
  const flip = model.turn ? -1 : 1;
  const parts = new Map();
  for (const face of faces) {
    const part = parts.get(face.key) ?? { color: face.key, positions: [] };
    for (const p of face.corners)
      part.positions.push(
        ...[
          flip * (p.x - center.x) * scale,
          (p.y - bounds.min.y) * scale,
          flip * (p.z - center.z) * scale,
        ].map((v) => Number(v.toFixed(5))),
      );
    parts.set(face.key, part);
  }
  writeFileSync(model.out, JSON.stringify({ parts: [...parts.values()] }));
  console.log(
    `${model.out}: ${faces.length} triangles in ${parts.size} colors`,
  );
}

/** Textured models shade each face a little differently; snapping to a few
 * named roles keeps them to a handful of meshes that can be recolored. */
function nearestRole(hex, roles) {
  const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  let best,
    bestDistance = Infinity;
  for (const [name, role] of roles) {
    const [rr, rg, rb] = rgb(role);
    const d = (r - rr) ** 2 + (g - rg) ** 2 + (b - rb) ** 2;
    if (d < bestDistance) {
      best = name;
      bestDistance = d;
    }
  }
  return best;
}
