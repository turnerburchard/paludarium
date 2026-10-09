import * as THREE from "three";
import type { Environment } from "../model/schema";
import { groundHeight } from "../model/terrain";
import { paintSamples, surfaceGrid } from "../model/terrainData";
import { waterLevel } from "../model/water";
import { MOSS_COLORS } from "../assets/landscape/mosses";

/** How far apart tufts grow on the carpet, and how tall the biggest stand. */
const TUFT_SPACING = 0.065;
const TUFT_HEIGHT = 0.03;
const TUFT_SIDES = 5;

/** Painted moss: a low skin over the ground, crowded with small tufts that
 * thin out toward its ragged edge. Everything is hashed from its place on
 * the ground, so painting more moss never reshuffles what is already there. */
export function makeGroundMoss(env: Environment) {
  const paint = env.terrain?.paint;
  if (!paint?.includes("moss")) return undefined;
  const [light, dark] = MOSS_COLORS.sheet.map((c) => new THREE.Color(c));
  const shade = dark.clone().multiplyScalar(0.5);
  // Moss on the tops of hummocks dries and yellows a little.
  const bleached = new THREE.Color(MOSS_COLORS.fern[1]);
  const tone = (amount: number, dryness = 0) =>
    shade
      .clone()
      .lerp(light, amount)
      .lerp(bleached, dryness * amount * 0.6);
  // How thickly moss grows at a spot, from 0 on its ragged edge to 1.
  const growth = (x: number, z: number) => {
    const coverage = paintSamples(x, z, env).reduce(
      (sum, sample) =>
        sum + (paint[sample.index] === "moss" ? sample.weight : 0),
      0,
    );
    const edge = 0.25 + 0.4 * hash(Math.floor(x / 0.1), Math.floor(z / 0.1), 7);
    return THREE.MathUtils.clamp((coverage - edge) / 0.3, 0, 1);
  };
  const underwater = (x: number, z: number, ground: number) =>
    ground < waterLevel(x, z, env) + 0.025;
  // Points are shared between faces to keep the carpet light enough to
  // rebuild on every brush dab. The material shades each face flat.
  const positions: number[] = [],
    colors: number[] = [],
    faces: number[] = [];
  const addPoint = (x: number, y: number, z: number, color: THREE.Color) => {
    positions.push(x, y, z);
    colors.push(color.r, color.g, color.b);
    return positions.length / 3 - 1;
  };

  const { columns, rows } = surfaceGrid(env);
  const skin = Array.from({ length: (columns + 1) * (rows + 1) }, (_, i) => {
    const col = i % (columns + 1),
      row = Math.floor(i / (columns + 1));
    const x = (col / columns - 0.5) * env.width,
      z = (row / rows - 0.5) * env.depth;
    if (growth(x, z) === 0) return -1;
    const ground = groundHeight(x, z, env);
    if (underwater(x, z, ground)) return -1;
    return addPoint(
      x,
      ground + 0.003,
      z,
      tone(0.15 + 0.25 * hash(col, row, 8)),
    );
  });
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const index = row * (columns + 1) + col;
      for (const triangle of [
        [index, index + columns + 1, index + 1],
        [index + 1, index + columns + 1, index + columns + 2],
      ])
        if (triangle.every((i) => skin[i] >= 0))
          faces.push(...triangle.map((i) => skin[i]));
    }

  const across = Math.ceil(env.width / TUFT_SPACING),
    deep = Math.ceil(env.depth / TUFT_SPACING);
  for (let i = 0; i < across; i++)
    for (let j = 0; j < deep; j++) {
      const x = ((i + hash(i, j, 1)) / across - 0.5) * env.width,
        z = ((j + hash(i, j, 2)) / deep - 0.5) * env.depth;
      const thickness = growth(x, z);
      if (thickness === 0) continue;
      const ground = groundHeight(x, z, env);
      if (underwater(x, z, ground)) continue;
      // Tufts swell into hummocks in some places and sink into hollows in
      // others, so the carpet rolls instead of growing like a lawn.
      const rise = hummocks(x, z);
      const size = (0.55 + 0.45 * hash(i, j, 3)) * (0.55 + 0.75 * rise);
      tuft(
        x,
        z,
        ground,
        TUFT_SPACING * 0.8 * size * (0.5 + 0.5 * thickness),
        TUFT_HEIGHT * size * thickness,
        hash(i, j, 4),
        rise,
      );
    }

  /** A low, faceted cushion: a ring at the ground, a narrower ring partway
   * up, and a crown, darker at its base and catching the light on top. */
  function tuft(
    x: number,
    z: number,
    ground: number,
    radius: number,
    height: number,
    shine: number,
    dryness: number,
  ) {
    const rimTone = tone(0.15 + 0.2 * shine),
      shoulderTone = tone(0.25 + 0.25 * shine, dryness);
    // The rim rests on the ground. The shoulder sits between rim points,
    // drawn in toward the crown and raised partway up it.
    const rim = Array.from({ length: TUFT_SIDES }, (_, k) => {
      const angle = (Math.PI * 2 * k) / TUFT_SIDES + shine * 6;
      // Tufts at the glass press flat against it instead of poking through.
      const rx = THREE.MathUtils.clamp(
          x + Math.cos(angle) * radius,
          -env.width / 2,
          env.width / 2,
        ),
        rz = THREE.MathUtils.clamp(
          z + Math.sin(angle) * radius,
          -env.depth / 2,
          env.depth / 2,
        );
      return [rx, groundHeight(rx, rz, env), rz];
    });
    const base = rim.map(([rx, ry, rz]) => addPoint(rx, ry, rz, rimTone));
    const middle = rim.map(([ax, ay, az], k) => {
      const [bx, by, bz] = rim[(k + 1) % TUFT_SIDES];
      return addPoint(
        (ax + bx) * 0.35 + x * 0.3,
        (ay + by) * 0.35 + ground * 0.3 + height * 0.65,
        (az + bz) * 0.35 + z * 0.3,
        shoulderTone,
      );
    });
    const crown = addPoint(
      x,
      ground + height,
      z,
      tone(0.45 + 0.45 * shine, dryness),
    );
    for (let k = 0; k < TUFT_SIDES; k++) {
      const next = (k + 1) % TUFT_SIDES;
      faces.push(base[k], middle[k], base[next]);
      faces.push(base[next], middle[k], middle[next]);
      faces.push(middle[k], crown, middle[next]);
    }
  }

  if (!faces.length) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(faces);
  return geometry;
}

/** Smooth rolling noise from 0 to 1, a hummock every third of a unit or so. */
function hummocks(x: number, z: number) {
  const gx = x / 0.32,
    gz = z / 0.32,
    ix = Math.floor(gx),
    iz = Math.floor(gz);
  const tx = THREE.MathUtils.smoothstep(gx - ix, 0, 1),
    tz = THREE.MathUtils.smoothstep(gz - iz, 0, 1);
  const corner = (i: number, j: number) => hash(i, j, 9);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(corner(ix, iz), corner(ix + 1, iz), tx),
    THREE.MathUtils.lerp(corner(ix, iz + 1), corner(ix + 1, iz + 1), tx),
    tz,
  );
}

function hash(i: number, j: number, salt: number) {
  const n = Math.sin(i * 127.1 + j * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
