import * as THREE from "three";
import { material, mesh } from "../geometry";
import type { MossSpecies } from "../../model/moss";
import type { AssetDefinition } from "../types";

/** Each moss's greens, light and dark, which its faces scatter between.
 * Shared with moss growing on stone and wood and moss painted on the ground. */
export const MOSS_COLORS: Record<MossSpecies, readonly [string, string]> = {
  cushion: ["#b3c98a", "#6c8c4c"],
  sheet: ["#5d8a33", "#3f6a26"],
  fern: ["#9ab43e", "#6e8f2c"],
  java: ["#4f7a35", "#2d5528"],
};

export const cushionMoss: AssetDefinition = {
  kind: "moss",
  name: "Cushion moss",
  scientificName: "Leucobryum glaucum",
  category: "Landscape",
  description: "Pale, rounded cushions that huddle together between stones.",
  radius: 0.34,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build: (random) => {
    const root = new THREE.Group();
    const skin = mossMaterial();
    // Cushions crowd together, a few big ones ringed by smaller ones.
    const count = 8 + Math.floor(random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2,
        reach = Math.sqrt(random()) * 0.22;
      const size = 0.05 + (1 - reach / 0.22) * 0.05 + random() * 0.03;
      mesh(dome(size, size * 0.75, "cushion", random), skin, root, [
        Math.cos(angle) * reach,
        0,
        Math.sin(angle) * reach,
      ]);
    }
    return root;
  },
};

export const sheetMoss: AssetDefinition = {
  kind: "sheet-moss",
  name: "Sheet moss",
  scientificName: "Hypnum cupressiforme",
  category: "Landscape",
  description: "A low, deep green carpet that spreads over soil and stone.",
  radius: 0.4,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build: (random) => {
    const root = new THREE.Group();
    const skin = mossMaterial();
    mesh(mat(0.36, 0.018, "sheet", random), skin, root);
    // A crowd of small, low lumps gives the carpet its plush texture.
    for (let i = 0; i < 26; i++) {
      const angle = random() * Math.PI * 2,
        reach = Math.sqrt(random()) * 0.26;
      const size = 0.035 + random() * 0.04;
      mesh(dome(size, size * 0.45, "sheet", random), skin, root, [
        Math.cos(angle) * reach,
        0.006,
        Math.sin(angle) * reach,
      ]);
    }
    return root;
  },
};

export const fernMoss: AssetDefinition = {
  kind: "fern-moss",
  name: "Fern moss",
  scientificName: "Thuidium delicatulum",
  category: "Landscape",
  description: "Feathery yellow-green sprigs that knit into a soft, lacy mat.",
  radius: 0.36,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build: (random) => {
    const root = new THREE.Group();
    const skin = mossMaterial();
    mesh(mat(0.3, 0.01, "fern", random), skin, root);
    mesh(sprigs(60, 0.3, "fern", random), skin, root);
    return root;
  },
};

export const javaMoss: AssetDefinition = {
  kind: "java-moss",
  name: "Java moss",
  scientificName: "Taxiphyllum barbieri",
  category: "Landscape",
  description: "A dark, tangled clump that drifts and wisps on the pool floor.",
  radius: 0.3,
  habitat: "water",
  build: (random) => {
    const root = new THREE.Group();
    const skin = mossMaterial();
    // A loose, tangled clump with wisps straying out of it.
    for (let i = 0; i < 4; i++) {
      const angle = random() * Math.PI * 2,
        reach = random() * 0.1;
      const size = 0.08 + random() * 0.05;
      mesh(dome(size, size * 0.8, "java", random, 0.3), skin, root, [
        Math.cos(angle) * reach,
        0,
        Math.sin(angle) * reach,
      ]);
    }
    mesh(strands(40, 0.17, random), skin, root);
    return root;
  },
};

export function mossMaterial() {
  const skin = material("#ffffff", 0.95);
  skin.vertexColors = true;
  return skin;
}

/** A face color somewhere between a moss's light and dark greens. */
export function mossTone(species: MossSpecies, random: () => number) {
  const [light, dark] = MOSS_COLORS[species];
  return new THREE.Color(dark).lerp(new THREE.Color(light), random());
}

function colorFaces(
  geometry: THREE.BufferGeometry,
  tone: (y: number) => THREE.Color,
) {
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 3) {
    const y =
      (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3;
    const color = tone(y);
    for (let k = 0; k < 3; k++)
      colors.set([color.r, color.g, color.b], (i + k) * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** A lumpy, faceted dome, lighter on top as cushions bleach in the light. */
export function dome(
  radius: number,
  height: number,
  species: MossSpecies,
  random: () => number,
  roughness = 0.12,
  detail = 2,
) {
  const geometry = new THREE.IcosahedronGeometry(1, detail).toNonIndexed();
  const position = geometry.getAttribute("position");
  const phase = random() * 10;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i);
    const lump =
      1 + roughness * Math.sin(x * 7 + phase) * Math.cos(z * 6 - phase);
    position.setXYZ(
      i,
      x * radius * lump,
      Math.max(0, y) * height * lump,
      z * radius * lump,
    );
  }
  geometry.computeVertexNormals();
  const [light] = MOSS_COLORS[species];
  return colorFaces(geometry, (y) =>
    mossTone(species, random).lerp(new THREE.Color(light), y / height / 2),
  );
}

/** A low mat with a ragged edge that slopes down to the ground. */
export function mat(
  radius: number,
  height: number,
  species: MossSpecies,
  random: () => number,
) {
  const sides = 14,
    rings = 4;
  const edge = Array.from({ length: sides }, () => 0.75 + random() * 0.35);
  const point = (ring: number, side: number) => {
    const angle = ((side % sides) / sides) * Math.PI * 2;
    const out = (ring / rings) * radius * edge[side % sides];
    const rise = ring === rings ? 0.002 : height * (0.6 + random() * 0.4);
    return new THREE.Vector3(
      Math.cos(angle) * out,
      rise,
      Math.sin(angle) * out,
    );
  };
  const grid = Array.from({ length: rings + 1 }, (_, ring) =>
    Array.from({ length: sides }, (_, side) => point(ring, side)),
  );
  const corners: THREE.Vector3[] = [];
  for (let ring = 0; ring < rings; ring++)
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides;
      const a = grid[ring][side],
        b = grid[ring][next],
        c = grid[ring + 1][side],
        d = grid[ring + 1][next];
      corners.push(a, b, d, a, d, c);
    }
  const geometry = new THREE.BufferGeometry().setFromPoints(corners);
  geometry.computeVertexNormals();
  return colorFaces(geometry, () => mossTone(species, random));
}

/** Tiny branching sprigs, each a stem with paired leaflets, lying over a mat. */
export function sprigs(
  count: number,
  radius: number,
  species: MossSpecies,
  random: () => number,
) {
  const corners: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2,
      reach = Math.sqrt(random()) * radius * 0.85;
    const base = new THREE.Vector3(
      Math.cos(angle) * reach,
      0.012,
      Math.sin(angle) * reach,
    );
    const heading = random() * Math.PI * 2;
    const along = new THREE.Vector3(
      Math.cos(heading),
      0.35,
      Math.sin(heading),
    ).normalize();
    const side = new THREE.Vector3(-along.z, 0, along.x).normalize();
    const length = 0.08 + random() * 0.06;
    for (let k = 0; k < 5; k++) {
      const at = base.clone().addScaledVector(along, (k / 5) * length);
      const size = length * 0.4 * (1 - k / 6);
      for (const s of [-1, 1])
        corners.push(
          at,
          at.clone().addScaledVector(along, length * 0.18),
          at
            .clone()
            .addScaledVector(side, s * size)
            .addScaledVector(along, size * 0.6),
        );
    }
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(corners);
  geometry.computeVertexNormals();
  return colorFaces(geometry, () => mossTone(species, random));
}

/** Thin, wavering wisps that stray outward and up from a clump. */
export function strands(count: number, radius: number, random: () => number) {
  const corners: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2,
      reach = Math.sqrt(random()) * radius;
    let at = new THREE.Vector3(
      Math.cos(angle) * reach,
      0.03 + random() * 0.05,
      Math.sin(angle) * reach,
    );
    const lean = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const width = 0.012;
    const across = new THREE.Vector3(-lean.z, 0, lean.x).multiplyScalar(width);
    const segments = 4;
    for (let s = 0; s < segments; s++) {
      const next = at
        .clone()
        .add(
          new THREE.Vector3(
            lean.x * 0.035 + (random() - 0.5) * 0.03,
            0.012 + random() * 0.025,
            lean.z * 0.035 + (random() - 0.5) * 0.03,
          ),
        );
      const taper = 1 - s / segments;
      corners.push(
        at.clone().addScaledVector(across, taper),
        next,
        at.clone().addScaledVector(across, -taper),
      );
      at = next;
    }
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(corners);
  geometry.computeVertexNormals();
  const [light, dark] = MOSS_COLORS.java.map((c) => new THREE.Color(c));
  return colorFaces(geometry, (y) =>
    dark.clone().lerp(light, Math.min(1, y / 0.2)),
  );
}
