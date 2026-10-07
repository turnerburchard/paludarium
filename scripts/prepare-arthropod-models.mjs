/** Bake crabs, scorpions and spiders into skinned data the synchronous asset
 * factories can use. These models are built from separate pieces: the
 * largest is the body, pieces that reach the ground are legs, and the rest
 * are arms such as claws. Each leg gets a hip, knee and tip bone fitted to
 * its shape, so ArthropodRig can plant its feet.
 * Sources are listed in docs/inspiration/ASSET-SOURCES.md.
 * Run from the repository root: node scripts/prepare-arthropod-models.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Box3, Mesh, Quaternion, Vector3 } from "three";
import { loadGlb, palette } from "./glb.mjs";

const MODELS = [
  {
    // "Crab" by jeremy, poly.pizza/m/bmZ6-LnPmp0, CC-BY 3.0.
    source: "docs/inspiration/models/crab-jeremy.glb",
    out: "src/assets/animals/vampireCrab.json",
    // It faces +X; crabs walk sideways, so its right side leads.
    forward: [0, 0, 1],
    width: 0.4,
  },
  {
    // "Scorpion" by Poly by Google, poly.pizza/m/6Bu7d_Pkm5o, CC-BY 3.0.
    source: "docs/inspiration/models/scorpion-poly-google.glb",
    out: "src/assets/animals/scorpion.json",
    forward: [0, 0, 1],
    width: 0.42,
    // A small desert scorpion has stubby pincers.
    arms: { scale: 0.6 },
  },
  {
    // "Spider" by Quaternius, poly.pizza/m/yRYJiAJyiM, CC0. Its own rig is
    // left out; the legs are refitted like the others.
    source: "docs/inspiration/models/spider-quaternius.glb",
    out: "src/assets/animals/tarantula.json",
    forward: [0, 0, 1],
    width: 0.42,
    // The red eyes.
    drop: ["932626"],
    // A tarantula's legs are short and stout next to this spider's.
    legs: { scale: 0.75, thicken: 2.2 },
  },
  {
    // The same crab, lower, with long thin legs and tiny claws: a Thai
    // micro crab.
    source: "docs/inspiration/models/crab-jeremy.glb",
    out: "src/assets/animals/microCrab.json",
    forward: [0, 0, 1],
    width: 0.19,
    squash: 0.75,
    arms: { scale: 0.35 },
    legs: { scale: 1.5, thicken: 0.6 },
  },
  {
    // "Crayfish" by Poly by Google, poly.pizza/m/3Y2cocX0ILR, CC-BY 3.0.
    source: "docs/inspiration/models/crayfish-poly-google.glb",
    out: "src/assets/animals/crayfish.json",
    forward: [0, 0, -1],
    width: 0.26,
    // Dwarf crayfish have small, slender claws. They and the feelers are
    // part of the body, so everything ahead of the head is drawn in.
    front: { beyond: 15, scale: 0.6 },
    // Its first, smallest legs reach forward under the claws.
    holdFront: 1,
  },
  {
    // "Crayfish" by Poly by Google, poly.pizza/m/bmtxAjfrpa3, CC-BY 3.0. It
    // is slender enough for a shrimp once its long front claws are cut down.
    source: "docs/inspiration/models/shrimp-poly-google.glb",
    out: "src/assets/animals/cherryShrimp.json",
    forward: [0, 0, 1],
    width: 0.19,
    arms: { scale: 0.3 },
    // Short legs keep it low to the ground.
    legs: { scale: 0.6, thicken: 1 },
    // It is one grey throughout, eyes included.
    eyes: "000000",
  },
];

for (const model of MODELS) await bake(model);

async function bake({
  source,
  out,
  forward,
  width,
  squash = 1,
  front,
  holdFront = 0,
  drop = [],
  eyes,
  arms,
  legs,
}) {
  const { gltf, images } = await loadGlb(readFileSync(source));
  const color = images.length ? palette(images[0]) : undefined;
  const turn = new Quaternion().setFromUnitVectors(
    new Vector3(...forward),
    new Vector3(0, 0, -1),
  );

  // Faces in habitat orientation, tagged with their source color.
  const faces = [];
  gltf.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry.toNonIndexed();
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < position.count; i += 3) {
      const key = (
        color ? color(uv.getX(i), uv.getY(i)) : object.material.color.getHex()
      )
        .toString(16)
        .padStart(6, "0");
      if (drop.includes(key)) continue;
      const corners = [0, 1, 2].map((k) =>
        new Vector3()
          .fromBufferAttribute(position, i + k)
          .applyMatrix4(object.matrixWorld)
          .applyQuaternion(turn)
          .multiply(new Vector3(1, squash, 1)),
      );
      faces.push({ color: key, corners });
    }
  });
  const pieces = connectedPieces(faces);

  const body = pieces.reduce((a, b) =>
    b.faces.length > a.faces.length ? b : a,
  );
  const center = centroid(body.points);
  const others = pieces.filter((piece) => piece !== body);
  const lowest = Math.min(...others.map((p) => p.box.min.y));
  const bounds = new Box3().setFromPoints(faces.flatMap((f) => f.corners));
  const reach = (bounds.max.y - bounds.min.y) * 0.02;
  const reaching = others.filter((p) => p.box.min.y < lowest + reach);
  // The front pairs that are held still, carried forward like the claws.
  const held = [...reaching]
    .sort((a, b) => a.box.min.z - b.box.min.z)
    .slice(0, holdFront * 2);
  const legPieces = reaching.filter((p) => !held.includes(p));
  // Small pieces such as eyes stay fixed to the body rather than moving as
  // arms.
  const size = (box) => box.getSize(new Vector3());
  const small = Math.max(size(body.box).x, size(body.box).z) * 0.1;
  const knobs = others.filter(
    (p) =>
      !legPieces.includes(p) &&
      Math.max(size(p.box).x, size(p.box).y, size(p.box).z) < small,
  );
  if (eyes)
    for (const piece of knobs)
      for (const face of piece.faces) face.color = eyes;
  knobs.push(...held);
  const armPieces = others.filter(
    (p) => !legPieces.includes(p) && !knobs.includes(p),
  );

  if (front)
    for (const p of body.points)
      if (-p.z > front.beyond) {
        p.x *= front.scale;
        p.z = -front.beyond + (p.z + front.beyond) * front.scale;
      }
  const fitted = legPieces.map((piece) =>
    fitLeg(piece.points, body.points),
  );
  const armRoots = armPieces.map((piece) => joining(piece.points, body.points));
  if (arms)
    armPieces.forEach((piece, i) =>
      piece.points.forEach((p) =>
        p.sub(armRoots[i]).multiplyScalar(arms.scale).add(armRoots[i]),
      ),
    );
  if (legs)
    legPieces.forEach((piece, i) => reshapeLeg(piece.points, fitted[i], legs));

  // Habitat scale: the given width across, centered over the origin and
  // resting on y = 0. Some bellies hang lower than the feet, so the ground
  // goes under the lowest point of all and the feet reach down to it.
  const all = new Box3().setFromPoints(faces.flatMap((f) => f.corners));
  const middle = all.getCenter(new Vector3());
  const scale = width / Math.max(all.max.x - all.min.x, all.max.z - all.min.z);
  const floor = all.min.y;
  // How far the body and arms can settle before they touch the ground.
  const settle =
    (Math.min(
      ...[body, ...knobs, ...armPieces].flatMap((piece) =>
        piece.points.map((p) => p.y),
      ),
    ) -
      floor) *
    scale;
  const toHabitat = (p) =>
    new Vector3(
      (p.x - middle.x) * scale,
      (p.y - floor) * scale,
      (p.z - middle.z) * scale,
    );

  // Bones: root, the body, an arm bone for each arm, and per leg a hip, knee
  // and tip in a chain, plus a foot under the root for planting.
  const joints = [
    ["root", null, new Vector3(middle.x, floor, middle.z)],
    ["body", "root", center],
    ...armRoots.map((at, i) => [`arm${i}`, "body", at]),
  ];
  // Going around the body by where the feet stand, each leg steps opposite
  // its neighbors.
  const around = (leg) =>
    Math.atan2(leg.tip.z - center.z, leg.tip.x - center.x);
  const order = fitted
    .map((leg, i) => ({ leg, i }))
    .sort((a, b) => around(a.leg) - around(b.leg));
  const specs = order.map(({ leg, i }, rank) => {
    joints.push(
      [`hip${i}`, "body", leg.hip],
      [`knee${i}`, `hip${i}`, leg.knee],
      [`tip${i}`, `knee${i}`, leg.tip],
      [`foot${i}`, "root", stance(leg, floor)],
    );
    return {
      foot: `foot${i}`,
      chain: [`hip${i}`, `knee${i}`],
      tip: `tip${i}`,
      pair: rank % 2,
    };
  });
  const at = new Map(joints.map(([name, , p]) => [name, toHabitat(p)]));
  const index = (name) => joints.findIndex(([n]) => n === name);
  const bones = joints.map(([name, parent]) => ({
    name,
    parent: parent === null ? -1 : index(parent),
    position: round(
      (parent
        ? at.get(name).clone().sub(at.get(parent))
        : at.get(name)
      ).toArray(),
      5,
    ),
  }));

  const weights = new Map();
  [body, ...knobs].forEach((piece) =>
    piece.points.forEach((p) => weights.set(p, [[index("body"), 1]])),
  );
  armPieces.forEach((piece, i) =>
    piece.points.forEach((p) => weights.set(p, [[index(`arm${i}`), 1]])),
  );
  legPieces.forEach((piece, i) => {
    const [hip, knee, tip] = ["hip", "knee", "tip"].map((n) =>
      at.get(`${n}${i}`),
    );
    for (const p of piece.points) {
      const scored = [
        {
          bone: index(`hip${i}`),
          d: distanceToSegment(toHabitat(p), hip, knee),
        },
        {
          bone: index(`knee${i}`),
          d: distanceToSegment(toHabitat(p), knee, tip),
        },
      ];
      const inverse = scored.map(({ d }) => 1 / Math.max(d, 1e-4) ** 4);
      const total = inverse[0] + inverse[1];
      weights.set(
        p,
        scored.map(({ bone }, k) => [bone, inverse[k] / total]),
      );
    }
  });

  const parts = new Map();
  for (const face of faces) {
    const part = parts.get(face.color) ?? {
      color: face.color,
      positions: [],
      skinIndex: [],
      skinWeight: [],
    };
    for (const corner of face.corners) {
      part.positions.push(...round(toHabitat(corner).toArray(), 5));
      const w = weights.get(corner);
      part.skinIndex.push(...[0, 1, 2, 3].map((n) => w[n]?.[0] ?? 0));
      part.skinWeight.push(
        ...[0, 1, 2, 3].map((n) => Number((w[n]?.[1] ?? 0).toFixed(3))),
      );
    }
    parts.set(face.color, part);
  }

  writeFileSync(
    out,
    JSON.stringify({
      bones,
      settle: round([settle], 5)[0],
      legs: specs,
      arms: armPieces.map((piece, i) => ({
        bone: `arm${i}`,
        lowers: lowering(piece.points, armRoots[i]),
      })),
      parts: [...parts.values()],
    }),
  );
  console.log(
    `${out}: ${faces.length} triangles in ${parts.size} colors, ${legPieces.length} legs, ${armPieces.length} arms.`,
  );
}

/** Groups faces that share corners. Corners are shared as one Vector3 per
 * position, so reshaping a point moves every face that touches it. */
function connectedPieces(faces) {
  const points = new Map();
  for (const face of faces)
    face.corners = face.corners.map((c) => {
      const key = c
        .toArray()
        .map((v) => v.toFixed(4))
        .join();
      if (!points.has(key)) points.set(key, c);
      return points.get(key);
    });
  const owner = new Map();
  const parent = faces.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  faces.forEach((face, i) =>
    face.corners.forEach((c) => {
      if (owner.has(c)) parent[find(i)] = find(owner.get(c));
      else owner.set(c, i);
    }),
  );
  const pieces = new Map();
  faces.forEach((face, i) => {
    const root = find(i);
    const piece = pieces.get(root) ?? { faces: [], points: new Set() };
    piece.faces.push(face);
    face.corners.forEach((c) => piece.points.add(c));
    pieces.set(root, piece);
  });
  return [...pieces.values()].map((piece) => {
    const points = [...piece.points];
    return {
      faces: piece.faces,
      points,
      box: new Box3().setFromPoints(points),
    };
  });
}

/** The hip is where the leg meets the body, the tip is the end farthest
 * from it, and the knee is the leg's highest point. A leg that is highest at
 * or behind its hip, such as one sloping straight down from the body, gets
 * its knee halfway along instead. */
function fitLeg(points, body) {
  const hip = joining(points, body);
  const far = Math.max(...points.map((p) => p.distanceTo(hip)));
  const tip = centroid(points.filter((p) => p.distanceTo(hip) > far * 0.95));
  const top = Math.max(...points.map((p) => p.y));
  const axis = tip.clone().sub(hip);
  const along = (p) => p.clone().sub(hip).dot(axis) / axis.lengthSq();
  let knee = centroid(points.filter((p) => p.y > top - far * 0.05));
  if (along(knee) < 0.2)
    knee = centroid(points.filter((p) => Math.abs(along(p) - 0.5) < 0.1));
  return { hip, knee, tip };
}

/** Feet stand a little inside the leg's full reach, so the knee stays bent
 * and the leg has room to stretch before it steps. */
function stance({ hip, tip }, floor) {
  const inward = tip.clone().sub(hip).setY(0).multiplyScalar(0.12);
  return tip.clone().sub(inward).setY(floor);
}

/** Shortens a leg toward its hip and fattens it around its bones. */
function reshapeLeg(points, leg, { scale, thicken }) {
  const segments = [
    [leg.hip, leg.knee],
    [leg.knee, leg.tip],
  ];
  for (const p of points) {
    const axis = segments
      .map(([a, b]) => nearestOnSegment(p, a, b))
      .reduce((a, b) => (a.distanceTo(p) < b.distanceTo(p) ? a : b));
    p.sub(axis).multiplyScalar(thicken).add(axis);
    p.sub(leg.hip).multiplyScalar(scale).add(leg.hip);
  }
  for (const joint of [leg.knee, leg.tip])
    joint.sub(leg.hip).multiplyScalar(scale).add(leg.hip);
}

/** The axis that tips an arm's far end down, turning it toward the ground. */
function lowering(points, root) {
  const end = points.reduce((a, b) =>
    a.distanceTo(root) > b.distanceTo(root) ? a : b,
  );
  const reach = end.clone().sub(root).setY(0).normalize();
  return round(new Vector3(0, 1, 0).cross(reach).normalize().toArray(), 4);
}

/** Where a piece meets the body: the middle of its points nearest it. */
function joining(points, body) {
  const gap = new Map(
    points.map((p) => [p, Math.min(...body.map((b) => b.distanceTo(p)))]),
  );
  const sorted = [...points].sort((a, b) => gap.get(a) - gap.get(b));
  return centroid(
    sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.15))),
  );
}

function centroid(points) {
  const sum = new Vector3();
  for (const p of points) sum.add(p);
  return sum.divideScalar(points.length);
}

function nearestOnSegment(p, a, b) {
  const axis = b.clone().sub(a);
  const t = Math.max(
    0,
    Math.min(1, p.clone().sub(a).dot(axis) / axis.lengthSq()),
  );
  return a.clone().addScaledVector(axis, t);
}

function distanceToSegment(p, a, b) {
  return p.distanceTo(nearestOnSegment(p, a, b));
}

function round(values, digits) {
  return values.map((v) => Number(v.toFixed(digits)));
}
