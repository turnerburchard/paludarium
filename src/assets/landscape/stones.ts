import * as THREE from "three";
import { bakedGeometry, type BakedModel } from "../baked";
import { mesh } from "../geometry";
import type { AssetDefinition } from "../types";
import flagstoneModel from "./flagstone.json";
import graniteModel from "./granite.json";
import limestonePinnacleModel from "./limestonePinnacle.json";
import sandstoneModel from "./sandstone.json";
import sandstonePillarModel from "./sandstonePillar.json";
import screeModel from "./scree.json";

/** Sandstone's banded reds and creams, from the darkest layer to the palest. */
const SANDSTONE = ["#8e4a2c", "#a85a33", "#b9703f", "#c98c56", "#d8aa77"];

export const sandstone: AssetDefinition = {
  kind: "sandstone",
  name: "Sandstone boulder",
  category: "Landscape",
  description:
    "A rounded desert boulder banded in red and cream, weathered smooth by wind and sand.",
  radius: 0.5,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: (random) => bakedStone(sandstoneModel, random, sandstoneBands(random)),
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
        0.18,
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
    "A big mountain boulder, pale grey flecked with pink and black, with tufts of grass in its cracks.",
  radius: 0.5,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: (random) => {
    const phase = random() * 10;
    return bakedStone(graniteModel, random, (center, _, source) => {
      if (source === "grass") return "#7d8f4a";
      if (source === "grassDark") return "#56662f";
      const n = fleck(center, phase);
      // Faint flecks of dark mica and pink feldspar in grey stone.
      if (n > 0.94) return "#8a8884";
      if (n > 0.88) return "#aca09a";
      return n > 0.4 ? "#a7a5a0" : "#9f9d98";
    });
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

export const sandstonePillar: AssetDefinition = {
  kind: "sandstone-pillar",
  name: "Sandstone pillar",
  category: "Landscape",
  description:
    "A tall, banded spire of red sandstone left standing after the softer rock around it wore away.",
  radius: 0.3,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: (random) =>
    bakedStone(sandstonePillarModel, random, sandstoneBands(random)),
};

export const limestonePinnacle: AssetDefinition = {
  kind: "limestone-pinnacle",
  name: "Limestone pinnacle",
  category: "Landscape",
  description:
    "A pale karst spire, streaked darker where rain runs down it and damp at its base.",
  radius: 0.34,
  habitat: "either",
  hardscape: "stone",
  blocksMovement: true,
  build: (random) => {
    const phase = random() * 10;
    return bakedStone(limestonePinnacleModel, random, (center, normal) => {
      if (normal.y > 0.6) return "#cdc9b6";
      if (center.y < 0.12) return "#8f8d80";
      return fleck(center, phase) > 0.7 ? "#a29f8e" : "#b3af9d";
    });
  },
};

export const flagstone: AssetDefinition = {
  kind: "flagstone",
  name: "Flat stone",
  category: "Landscape",
  description:
    "A broad, flat stone set into the ground, for stepping across wet soil or basking on.",
  radius: 0.35,
  habitat: "either",
  hardscape: "stone",
  build: (random) => {
    const phase = random() * 10;
    return bakedStone(flagstoneModel, random, (center, normal) => {
      if (normal.y < 0.6) return "#6c6152";
      return fleck(center, phase) > 0.6 ? "#93897a" : "#857b6c";
    });
  },
};

export const scree: AssetDefinition = {
  kind: "scree",
  name: "Scree",
  category: "Landscape",
  description:
    "Sharp, broken rocks shed from a mountainside, crusted here and there with pale lichen.",
  radius: 0.3,
  habitat: "either",
  hardscape: "stone",
  build: (random) => {
    const phase = random() * 10;
    return bakedStone(screeModel, random, (center, normal) => {
      const n = fleck(center, phase);
      if (normal.y > 0.5 && n > 0.85) return "#8a8f7c";
      if (normal.y < 0) return "#4f545b";
      return n > 0.4 ? "#6d737a" : "#5f656c";
    });
  },
};

/** A baked rock model painted face by face. Each placement stretches it a
 * little differently, so repeats of the same model don't match exactly. */
function bakedStone(
  model: BakedModel,
  random: () => number,
  colorOf: (
    center: THREE.Vector3,
    normal: THREE.Vector3,
    source: string,
  ) => string,
) {
  const root = new THREE.Group();
  for (const part of model.parts) {
    const geo = bakedGeometry(part);
    paint(geo, (center, normal) => colorOf(center, normal, part.color));
    mesh(geo, stoneSkin(), root);
  }
  root.scale.set(
    0.9 + random() * 0.2,
    0.9 + random() * 0.2,
    0.9 + random() * 0.2,
  );
  return root;
}

/** Red and cream layers by height, each a different shade, with the bedding
 * tilted a little as it is in real outcrops. Upward faces bleach paler. */
function sandstoneBands(random: () => number) {
  const thickness = 0.12 + random() * 0.05;
  // Neighboring layers differ by a shade at most, so the bands read as soft
  // stripes rather than a patchwork.
  let tone = 1 + Math.floor(random() * 2);
  const tones = Array.from({ length: 16 }, () => {
    tone = Math.min(3, Math.max(1, tone + Math.floor(random() * 3) - 1));
    return tone;
  });
  const tilt = (random() - 0.5) * 0.2;
  return (center: THREE.Vector3, normal: THREE.Vector3) => {
    if (normal.y > 0.75) return SANDSTONE[4];
    const band = Math.max(
      0,
      Math.floor((center.y + center.x * tilt) / thickness),
    );
    return SANDSTONE[tones[band % tones.length]];
  };
}

/** A hash of a face's position, spread evenly between 0 and 1, for speckling
 * faces without any pattern. */
function fleck(center: THREE.Vector3, phase: number) {
  const n =
    Math.sin(center.x * 91.7 + center.y * 57.3 + center.z * 73.1 + phase) *
    43758.5453;
  return n - Math.floor(n);
}

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
 * stacked slabs never line up. A bevel pulls the top and bottom rims in so
 * the edges look worn rather than sawn. */
function slab(
  width: number,
  height: number,
  depth: number,
  random: () => number,
  bevel = 0,
) {
  const sides = 7;
  const geo = new THREE.CylinderGeometry(0.5, 0.5, height, sides, 2);
  const positions = geo.getAttribute("position");
  const jitter = Array.from({ length: sides }, () => 0.65 + random() * 0.5);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    if (Math.hypot(x, z) < 0.01) continue;
    const side =
      Math.round(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * sides) %
      sides;
    const rim = Math.abs(positions.getY(i)) > height / 4 ? 1 - bevel : 1;
    positions.setX(i, x * width * jitter[side] * rim);
    positions.setZ(i, z * depth * jitter[side] * rim);
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
