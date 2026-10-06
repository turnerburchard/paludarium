import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ringVolume, triangles, type Point } from "../faceted";
import type { AssetDefinition } from "../types";

export const cardinalTetra: AssetDefinition = {
  kind: "cardinal-tetra",
  name: "Cardinal tetra",
  scientificName: "Paracheirodon axelrodi",
  category: "Animals",
  description:
    "A slender schooling fish with an electric blue stripe over a red belly. Add several.",
  radius: 0.12,
  habitat: "water",
  swims: { speed: 0.3, depth: 0.2 },
  build: () =>
    tetra({
      length: 0.17,
      depth: 0.036,
      width: 0.018,
      back: "#3c4a3c",
      stripe: "#3fd2ea",
      belly: "#d33b2f",
      // Cardinals are red from the gills all the way to the tail.
      redFrom: -0.65,
      fin: "#cdbfae",
    }),
};

export const emberTetra: AssetDefinition = {
  kind: "ember-tetra",
  name: "Ember tetra",
  scientificName: "Hyphessobrycon amandae",
  category: "Animals",
  description:
    "A tiny glowing orange fish that drifts in loose groups near the surface.",
  radius: 0.1,
  habitat: "water",
  swims: { speed: 0.24, depth: 0.09 },
  build: () =>
    tetra({
      length: 0.13,
      depth: 0.04,
      width: 0.016,
      back: "#c4542c",
      stripe: "#ec7240",
      belly: "#f08a4e",
      redFrom: -1,
      fin: "#f29a62",
    }),
};

interface Tetra {
  /** Snout to the base of the tail, facing -Z. */
  length: number;
  /** Half the body's depth and width at its deepest. */
  depth: number;
  width: number;
  back: string;
  stripe: string;
  belly: string;
  /** Where the red lower body starts, as Z from the middle of the fish. */
  redFrom: number;
  fin: string;
}

/** A compressed, spindle-shaped body colored in bands, with a forked tail on
 * its own group so it can sway. */
function tetra(spec: Tetra) {
  const root = new THREE.Group();
  const half = spec.length / 2;
  // Position along the body, depth and width as fractions of the deepest.
  const sections = [
    [-1, 0.25, 0.3],
    [-0.75, 0.75, 0.8],
    [-0.35, 1, 1],
    [0.15, 0.85, 0.85],
    [0.65, 0.45, 0.5],
    [1, 0.2, 0.25],
  ];
  const rings = sections.map(([t, depth, width]) =>
    Array.from({ length: 8 }, (_, side): Point => {
      const angle = (side * Math.PI) / 4;
      return [
        Math.cos(angle) * spec.width * width,
        Math.sin(angle) * spec.depth * depth,
        t * half,
      ];
    }),
  );
  const body = ringVolume(rings);
  const position = body.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const back = new THREE.Color(spec.back),
    stripe = new THREE.Color(spec.stripe),
    belly = new THREE.Color(spec.belly),
    silver = new THREE.Color("#d9d6cc");
  for (let i = 0; i < position.count; i += 3) {
    let y = 0,
      z = 0;
    for (let k = 0; k < 3; k++) {
      y += position.getY(i + k) / 3;
      z += position.getZ(i + k) / 3;
    }
    const height = y / spec.depth;
    let color = belly;
    if (height > 0.45) color = back;
    else if (height > 0.05) color = stripe;
    else if (z < spec.redFrom * half) color = silver;
    for (let k = 0; k < 3; k++)
      colors.set([color.r, color.g, color.b], (i + k) * 3);
  }
  body.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const skin = material("#ffffff", 0.45);
  skin.vertexColors = true;
  mesh(body, skin, root);

  const fin = material(spec.fin, 0.8);
  const tail = new THREE.Group();
  tail.name = "tail";
  tail.position.z = half;
  root.add(tail);
  const t = spec.depth * 1.5;
  mesh(
    triangles(
      [
        [0, 0, 0],
        [0, t, t * 1.3],
        [0, t * 0.25, t * 0.9],
        [0, 0, t * 0.6],
        [0, -t * 0.25, t * 0.9],
        [0, -t, t * 1.3],
      ],
      [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5],
    ),
    fin,
    tail,
  );
  // A tall dorsal fin, a small adipose fin behind it and a long anal fin.
  const fins: Point[][] = [
    [
      [0, spec.depth * 0.9, -0.1 * half],
      [0, spec.depth * 2, 0.15 * half],
      [0, spec.depth * 0.8, 0.3 * half],
    ],
    [
      [0, spec.depth * 0.5, 0.62 * half],
      [0, spec.depth * 0.9, 0.72 * half],
      [0, spec.depth * 0.45, 0.78 * half],
    ],
    [
      [0, -spec.depth * 0.8, 0.05 * half],
      [0, -spec.depth * 1.6, 0.4 * half],
      [0, -spec.depth * 0.5, 0.7 * half],
    ],
  ];
  for (const points of fins) mesh(triangles(points, [0, 1, 2]), fin, root);
  const dark = material("#141a18", 0.3);
  for (const side of [-1, 1]) {
    const eye = mesh(
      new THREE.IcosahedronGeometry(spec.depth * 0.24, 0),
      dark,
      root,
      [side * spec.width * 0.7, spec.depth * 0.25, -0.72 * half],
    );
    eye.scale.x = 0.5;
  }
  return root;
}
