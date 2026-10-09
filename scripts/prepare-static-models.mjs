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
    source: "docs/inspiration/models/peace-lily-zsky.glb",
    out: "src/assets/plants/peaceLily.json",
    skip: ["VaseFlowerPot4", "GroundFlowerPot4"],
    height: 0.95,
  },
  {
    // "Big Leaf Plant" by reyshapes, poly.pizza/m/aKIm5k6l5F, CC0. Every leaf
    // is white with its own material, so leaves are told apart by material.
    source: "docs/inspiration/models/alocasia-reyshapes.glb",
    out: "src/assets/plants/alocasia.json",
    byMaterial: true,
    height: 1.5,
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
  {
    // "Rock Large" by Quaternius, poly.pizza/m/54jZKTAt5p, CC0.
    source: "docs/inspiration/models/rock-large-quaternius.glb",
    out: "src/assets/landscape/sandstone.json",
    width: 1.05,
    sink: 0.08,
  },
  {
    // "Rock" by Poly by Google, poly.pizza/m/dmRuyy1VXEv, CC-BY 3.0.
    source: "docs/inspiration/models/rock-poly-google.glb",
    out: "src/assets/landscape/granite.json",
    width: 1,
    sink: 0.25,
    roles: {
      rock: "c08048",
      rockDark: "5a3820",
      grass: "b0c048",
      grassDark: "4a5018",
    },
  },
  {
    // "Rock Flat" by Kenney, poly.pizza/m/CrSoV13mCU, CC0.
    source: "docs/inspiration/models/rock-flat-kenney.glb",
    out: "src/assets/landscape/flagstone.json",
    solid: true,
    width: 0.7,
    sink: 0.3,
  },
  {
    // "Rocks" by Quaternius, poly.pizza/m/OQvi8PIZ40, CC0.
    source: "docs/inspiration/models/rocks-quaternius.glb",
    out: "src/assets/landscape/scree.json",
    width: 0.6,
  },
  {
    // "Rock" by Quaternius, poly.pizza/m/R2UjZAX3By, CC0.
    source: "docs/inspiration/models/rock-spire-quaternius.glb",
    out: "src/assets/landscape/sandstonePillar.json",
    height: 0.9,
    sink: 0.08,
  },
  {
    // "Rock Large" by Quaternius, poly.pizza/m/d2VWOdthtR, CC0.
    source: "docs/inspiration/models/rock-large-spire-quaternius.glb",
    out: "src/assets/landscape/limestonePinnacle.json",
    height: 0.95,
    sink: 0.03,
  },
  {
    // "log with fungus" by sirkitree, poly.pizza/m/32czhZtc7oY, CC-BY 3.0.
    source: "docs/inspiration/models/log-fungus-sirkitree.glb",
    out: "src/assets/landscape/fungusLog.json",
    solid: true,
    length: 1.15,
    sink: 0.1,
  },
  {
    // "Log" by Poly by Google, poly.pizza/m/dkRLlPSdgdR, CC-BY 3.0.
    source: "docs/inspiration/models/log-poly-google.glb",
    out: "src/assets/landscape/snag.json",
    width: 1.2,
    sink: 0.12,
    roles: { bark: "75522f", barkLight: "9e6a3a", cut: "d98d4a" },
  },
  {
    // "Tree roots" by Poly by Google, poly.pizza/m/eYfjQLsebfA, CC-BY 3.0.
    source: "docs/inspiration/models/tree-roots-poly-google.glb",
    out: "src/assets/landscape/treeRoots.json",
    // Laid on its side, so the roots fan out over the bottom.
    layDown: true,
    length: 1.1,
    sink: 0.3,
    solid: true,
    roles: { wood: "7d5b32", cut: "c08444", dark: "130701" },
  },
  {
    // "Tree Stump with Moss" by Quaternius, poly.pizza/m/nFvEbUX6LE, CC0.
    source: "docs/inspiration/models/stump-moss-quaternius.glb",
    out: "src/assets/landscape/stump.json",
    width: 0.8,
    sink: 0.05,
    solid: true,
  },
  {
    // "Flower Pot" by Neko, poly.pizza/m/A7g6zgWaCj, CC-BY 3.0; the pot and
    // its soil are left out.
    source: "docs/inspiration/models/monstera-neko.glb",
    out: "src/assets/plants/monstera.json",
    skipColors: ["23272b", "390b08"],
    height: 1.7,
    roles: { top: "97c257", mid: "7bb053", under: "64a050" },
    // Each leaf's pale upper side is where frogs rest.
    perches: "top",
  },
  {
    // "Mushroom" by Сергей Тиньков, poly.pizza/m/1CZoDfdfHl_, CC-BY 3.0.
    source: "docs/inspiration/models/mushroom-tinkov.glb",
    out: "src/assets/landscape/bolete.json",
    height: 0.24,
  },
  {
    // "Mushroom" by jeremy, poly.pizza/m/2DAaKHD48ZP, CC-BY 3.0.
    source: "docs/inspiration/models/mushroom-jeremy.glb",
    out: "src/assets/landscape/flyAgaric.json",
    height: 0.3,
  },
  {
    // "Mushroom" by Quaternius, poly.pizza/m/aOW08oSrd4, CC0.
    source: "docs/inspiration/models/mushroom-quaternius.glb",
    out: "src/assets/landscape/bonnetMushrooms.json",
    width: 0.42,
    roles: { clump: "a38f80" },
  },
  {
    // "Dead Tree Trunk" by Zsky, poly.pizza/m/HdJ7JoEvKR, CC-BY 3.0.
    source: "docs/inspiration/models/dead-tree-zsky.glb",
    out: "src/assets/landscape/deadTree.json",
    height: 1.15,
    solid: true,
  },
  {
    // "Mushroom_Laetiporus" from Quaternius's Stylized Nature MegaKit, CC0,
    // cut from 3216 to 400 triangles in Blender.
    source: "docs/inspiration/models/laetiporus-quaternius.glb",
    out: "src/assets/landscape/chickenOfTheWoods.json",
    width: 0.45,
    roles: { shelf: "b08040", rim: "d0b060" },
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
      // A pot modeled in the same mesh as its plant is left out by color.
      if (model.skipColors?.includes(source)) continue;
      faces.push({
        key: model.byMaterial
          ? material.name
          : roles
            ? nearestRole(source, roles)
            : source,
        corners: [0, 1, 2].map((k) => {
          const corner = new Vector3()
            .fromBufferAttribute(position, i + k)
            .applyMatrix4(object.matrixWorld);
          // Tips an upright model onto its back: up becomes forward.
          return model.layDown
            ? corner.set(corner.x, -corner.z, corner.y)
            : corner;
        }),
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
  // Rocks and logs settle part of their height into the ground.
  const floor = bounds.min.y + (model.sink ?? 0) * size.y;
  const parts = new Map();
  const kept = new Set();
  const keptFaces = [];
  for (const face of faces) {
    const corners = face.corners.map((p) =>
      [
        flip * (p.x - center.x) * scale,
        (p.y - floor) * scale,
        flip * (p.z - center.z) * scale,
      ].map((v) => Number(v.toFixed(5))),
    );
    // Some models stack a back face on a front face. Animals walk hardscape
    // by its face normals, and a back-to-back pair cancels out to nothing.
    const shape = corners.map(String).sort().join("|");
    if (model.solid && kept.has(shape)) continue;
    kept.add(shape);
    keptFaces.push({ key: face.key, corners });
    const part = parts.get(face.key) ?? { color: face.key, positions: [] };
    part.positions.push(...corners.flat());
    parts.set(face.key, part);
  }
  writeFileSync(
    model.out,
    JSON.stringify({
      parts: [...parts.values()],
      ...(model.perches && {
        perches: leafPerches(keptFaces, model.perches),
      }),
    }),
  );
  console.log(
    `${model.out}: ${faces.length} triangles in ${parts.size} colors`,
  );
}

/** Where frogs can climb and rest on a plant: onto the middle of each leaf's
 * upper side (the faces colored `top`, which form one sheet per leaf), up
 * from the base of the stem that leaf grows on. */
function leafPerches(faces, top) {
  const plants = connectedPieces(faces.map((face) => face.corners));
  const leaves = connectedPieces(
    faces.filter((face) => face.key === top).map((face) => face.corners),
  );
  const perches = [];
  for (const leaf of leaves) {
    if (leaf.faces.length < 8) continue;
    const center = new Vector3(),
      normal = new Vector3();
    let area = 0;
    for (const corners of leaf.faces) {
      const [a, b, c] = corners.map((p) => new Vector3(...p));
      const cross = b.clone().sub(a).cross(c.clone().sub(a));
      const weight = cross.length() / 2;
      center.addScaledVector(a.add(b).add(c).divideScalar(3), weight);
      // Upper sides may be wound either way; count them all facing up.
      normal.add(cross.y < 0 ? cross.negate() : cross);
      area += weight;
    }
    center.divideScalar(area);
    normal.normalize();
    if (normal.y < 0.3) continue;
    // A deeply split leaf's upper side breaks into a sheet per lobe; one
    // perch is enough for lobes side by side.
    if (perches.some(({ perch }) => center.distanceTo(perch) < 0.12)) continue;
    const corner = String(leaf.faces[0][0]);
    const plant = plants.find((piece) =>
      piece.faces.some((corners) => corners.some((p) => String(p) === corner)),
    );
    const base = plant.points[0].clone().setY(0);
    // Halfway up, snapped onto the plant itself, which is usually its stem.
    const halfway = base.clone().lerp(center, 0.5);
    const middle = plant.points.reduce((best, p) =>
      p.distanceTo(halfway) < best.distanceTo(halfway) ? p : best,
    );
    const point = (v) => {
      const [x, y, z] = v.toArray().map((n) => Number(n.toFixed(4)));
      return { x, y, z };
    };
    perches.push({
      stem: [point(base), point(middle)],
      perch: point(center.clone().addScaledVector(normal, 0.01)),
      perchNormal: point(normal),
    });
  }
  return perches;
}

/** Groups faces that share corners into separate pieces, with their points
 * sorted from lowest to highest. */
function connectedPieces(faces) {
  const parent = faces.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map();
  faces.forEach((corners, i) => {
    for (const corner of corners) {
      const key = String(corner);
      if (owner.has(key)) parent[find(i)] = find(owner.get(key));
      else owner.set(key, i);
    }
  });
  const pieces = new Map();
  faces.forEach((corners, i) => {
    const piece = pieces.get(find(i)) ?? { faces: [] };
    piece.faces.push(corners);
    pieces.set(find(i), piece);
  });
  return [...pieces.values()].map((piece) => ({
    faces: piece.faces,
    points: piece.faces
      .flat()
      .map((p) => new Vector3(...p))
      .sort((a, b) => a.y - b.y),
  }));
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
