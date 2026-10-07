import * as THREE from "three";
import { mesh } from "../geometry";
import { ringVolume, type Point } from "../faceted";
import type { AssetDefinition } from "../types";

/** Sandstone's banded reds and creams, from the darkest layer to the palest. */
const SANDSTONE = ["#8e4a2c", "#a85a33", "#b9703f", "#c98c56", "#d8aa77"];

export const sandstone: AssetDefinition = {
  kind: "sandstone",
  name: "Sandstone boulder",
  category: "Landscape",
  description:
    "A rounded desert boulder banded in red and cream, its softer layers worn into ledges.",
  radius: 0.45,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: (random) => {
    const root = new THREE.Group();
    // Layers stack up from the base. Softer ones wear back between harder
    // ledges, and the block rounds off toward the top.
    const layers = 7 + Math.floor(random() * 3);
    const height = 0.38 + random() * 0.12;
    const outline = Array.from({ length: 10 }, () => 0.8 + random() * 0.35);
    const rings: Point[][] = [];
    const tones: string[] = [];
    for (let l = 0; l < layers; l++) {
      const bottom = (l / layers) * height,
        top = ((l + 1) / layers) * height;
      const round = Math.sqrt(1 - Math.pow((l + 0.5) / layers, 4));
      const soft =
        (l % 2 === 1 && random() < 0.8 ? 0.9 : 1) * (0.95 + random() * 0.08);
      const shiftX = (random() - 0.5) * 0.04,
        shiftZ = (random() - 0.5) * 0.04;
      const ring = (y: number) =>
        outline.map((r, side): Point => {
          const a = (side / outline.length) * Math.PI * 2;
          const radius = 0.45 * r * round * soft;
          return [
            Math.cos(a) * radius * 1.15 + shiftX,
            y,
            -Math.sin(a) * radius * 0.85 + shiftZ,
          ];
        });
      rings.push(ring(bottom), ring(top));
      tones.push(SANDSTONE[(l + Math.floor(random() * 2)) % SANDSTONE.length]);
    }
    const geo = ringVolume(rings);
    paint(geo, (center) => {
      const layer = Math.floor((center.y / height) * layers - 0.001);
      return tones[Math.max(0, Math.min(layers - 1, layer))];
    });
    mesh(geo, stoneSkin(), root);
    return root;
  },
};

export const sandstoneLedge: AssetDefinition = {
  kind: "sandstone-ledge",
  name: "Sandstone ledge",
  category: "Landscape",
  description:
    "Flat slabs of red sandstone stacked in steps, a warm place for lizards to bask.",
  radius: 0.55,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  shelter: true,
  build: (random) => {
    const root = new THREE.Group();
    let y = 0;
    const count = 3 + Math.floor(random() * 2);
    for (let i = 0; i < count; i++) {
      const height = 0.09 + random() * 0.05;
      const geo = slab(
        0.95 - i * 0.18 + random() * 0.1,
        height,
        0.7 - i * 0.1 + random() * 0.1,
        random,
      );
      const side = SANDSTONE[(i + Math.floor(random() * 2)) % SANDSTONE.length];
      const top = SANDSTONE[Math.min(SANDSTONE.length - 1, i + 2)];
      paint(geo, (_, normal) => (normal.y > 0.5 ? top : side));
      const part = mesh(geo, stoneSkin(), root, [
        (random() - 0.5) * 0.18,
        y + height / 2,
        (random() - 0.5) * 0.14 - i * 0.05,
      ]);
      part.rotation.y = (random() - 0.5) * 0.7;
      y += height * 0.95;
    }
    return root;
  },
};

export const granite: AssetDefinition = {
  kind: "granite",
  name: "Granite boulder",
  category: "Landscape",
  description:
    "A big, smooth mountain boulder, pale grey flecked with pink and black.",
  radius: 0.5,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: (random) => {
    const root = new THREE.Group();
    const phase = random() * 10;
    const geo = shapedStone(0.5, 2, (x, y, z) => {
      const rough = 1 + 0.08 * Math.sin(x * 7 + z * 5 + phase);
      return [x * rough * 1.1, Math.max(-0.24, y * rough * 0.9), z * rough];
    });
    paint(geo, (center) => {
      // A hash of the face's position, spread evenly between 0 and 1.
      const n =
        Math.sin(center.x * 91.7 + center.y * 57.3 + center.z * 73.1 + phase) *
        43758.5453;
      const fleck = n - Math.floor(n);
      if (fleck > 0.94) return "#4a4848";
      if (fleck > 0.88) return "#b8948a";
      return fleck > 0.4 ? "#a7a5a0" : "#9a9893";
    });
    mesh(geo, stoneSkin(), root, [0, 0.24, 0]);
    return root;
  },
};

export const slate: AssetDefinition = {
  kind: "slate",
  name: "Slate stack",
  category: "Landscape",
  description:
    "Thin, dark plates of slate piled at angles, with crevices between them.",
  radius: 0.48,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  shelter: true,
  build: (random) => {
    const root = new THREE.Group();
    const tones = ["#4a5058", "#3d434b", "#565c63"];
    let y = 0;
    for (let i = 0; i < 6; i++) {
      const height = 0.035 + random() * 0.025;
      const geo = slab(
        0.65 + random() * 0.3,
        height,
        0.45 + random() * 0.25,
        random,
      );
      const tone = tones[i % tones.length];
      paint(geo, () => tone);
      const part = mesh(geo, stoneSkin(), root, [
        (random() - 0.5) * 0.25,
        y + height / 2,
        (random() - 0.5) * 0.2,
      ]);
      part.rotation.set(
        (random() - 0.5) * 0.18,
        random() * Math.PI,
        (random() - 0.5) * 0.18,
      );
      y += height * 0.9;
    }
    return root;
  },
};

export const limestone: AssetDefinition = {
  kind: "limestone",
  name: "Limestone outcrop",
  category: "Landscape",
  description:
    "Pale, pitted karst stone with fluted sides and hollows where moss and frogs settle.",
  radius: 0.42,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: (random) => {
    const root = new THREE.Group();
    const phase = random() * 10;
    const geo = shapedStone(0.42, 2, (x, y, z) => {
      // Rain dissolves vertical flutes down the sides and pockets the top.
      const flute = Math.abs(Math.sin(Math.atan2(z, x) * 4 + phase));
      const pit = Math.max(
        0,
        Math.sin(x * 17 + phase) * Math.sin(z * 19 - phase),
      );
      const rough = 0.8 + flute * 0.25;
      const top = Math.max(0, y);
      return [
        x * rough,
        Math.max(-0.2, y * 1.45 - top * pit * 0.4),
        z * rough * 0.9,
      ];
    });
    paint(geo, (center, normal) =>
      normal.y > 0.6 ? "#cdc9b6" : center.y < 0 ? "#8f8d80" : "#b3af9d",
    );
    mesh(geo, stoneSkin(), root, [0, 0.29, 0]);
    return root;
  },
};

export const pebbles: AssetDefinition = {
  kind: "pebbles",
  name: "River pebbles",
  category: "Landscape",
  description:
    "A scatter of smooth, rounded pebbles in mixed greys and browns.",
  radius: 0.36,
  habitat: "either",
  hardscape: "stone",
  build: (random) => {
    const root = new THREE.Group();
    const tones = ["#7d7466", "#93897a", "#5e5a55", "#a59a87", "#6c6152"];
    const count = 7 + Math.floor(random() * 4);
    for (let i = 0; i < count; i++) {
      const angle = i * 2.4 + random(),
        reach = Math.sqrt(random()) * 0.26;
      const size = 0.06 + random() * 0.06;
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const tone = tones[Math.floor(random() * tones.length)];
      paint(geo, () => tone);
      const part = mesh(geo, stoneSkin(0.45), root, [
        Math.cos(angle) * reach,
        size * 0.45,
        Math.sin(angle) * reach,
      ]);
      part.scale.set(size * (1.1 + random() * 0.5), size * 0.55, size);
      part.rotation.y = random() * Math.PI;
    }
    return root;
  },
};

/** An icosahedron stone reshaped vertex by vertex. The shape depends only on
 * each corner's position, so the faces stay closed. */
function shapedStone(
  radius: number,
  detail: number,
  shape: (x: number, y: number, z: number) => [number, number, number],
) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const positions = geo.getAttribute("position");
  for (let i = 0; i < positions.count; i++)
    positions.setXYZ(
      i,
      ...shape(positions.getX(i), positions.getY(i), positions.getZ(i)),
    );
  geo.computeVertexNormals();
  return geo;
}

/** A flat, irregular slab: a seven-sided plate with a jittered outline, so
 * stacked slabs never line up. */
function slab(
  width: number,
  height: number,
  depth: number,
  random: () => number,
) {
  const sides = 7;
  const geo = new THREE.CylinderGeometry(0.5, 0.5, height, sides, 1);
  const positions = geo.getAttribute("position");
  const jitter = Array.from({ length: sides }, () => 0.65 + random() * 0.5);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    if (Math.hypot(x, z) < 0.01) continue;
    const side =
      Math.round(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * sides) %
      sides;
    positions.setX(i, x * width * jitter[side]);
    positions.setZ(i, z * depth * jitter[side]);
  }
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  return flat;
}

/** Colors each face from its center and normal. */
function paint(
  geo: THREE.BufferGeometry,
  colorOf: (center: THREE.Vector3, normal: THREE.Vector3) => string,
) {
  const positions = geo.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i);
    b.fromBufferAttribute(positions, i + 1);
    c.fromBufferAttribute(positions, i + 2);
    const center = a.clone().add(b).add(c).divideScalar(3);
    const normal = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3());
    color.set(colorOf(center, normal));
    for (let k = 0; k < 3; k++)
      colors.set([color.r, color.g, color.b], (i + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function stoneSkin(roughness = 0.85) {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness,
  });
}
