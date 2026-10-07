import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ringVolume, triangles, type Point } from "../faceted";
import type { AssetDefinition } from "../types";

export const angelfish: AssetDefinition = {
  kind: "angelfish",
  name: "Freshwater angelfish",
  scientificName: "Pterophyllum scalare",
  group: "Fish",
  biomes: ["Tropical"],
  description:
    "A tall, silver disc of a fish with black bars and long trailing fins. It glides slowly through the middle of the water.",
  radius: 0.2,
  habitat: "water",
  swims: { speed: 0.14, depth: 0.25 },
  build: () =>
    fish({
      length: 0.2,
      depth: 0.085,
      width: 0.02,
      sections: [
        [-1, 0.3, 0.45],
        [-0.8, 0.65, 0.7],
        [-0.55, 0.88, 0.9],
        [-0.25, 1, 1],
        [0.05, 0.97, 0.95],
        [0.35, 0.82, 0.8],
        [0.65, 0.55, 0.55],
        [0.85, 0.3, 0.35],
        [1, 0.2, 0.25],
      ],
      // Three dark bars run down through the eye, the middle and the tail.
      paint: (_, z) =>
        [-0.68, -0.1, 0.5].some((bar) => Math.abs(z - bar) < 0.11)
          ? "#2b2a28"
          : "#d8d6cc",
      tail: "fan",
      fin: "#c9c7bd",
      fins: (d, h) => [
        // Long swept-back dorsal and anal fins, and thread-like pelvic fins.
        [
          [0, d * 0.95, -0.4 * h],
          [0, d * 2.3, 1.5 * h],
          [0, d * 0.55, 0.75 * h],
        ],
        [
          [0, -d * 0.95, -0.3 * h],
          [0, -d * 2.2, 1.45 * h],
          [0, -d * 0.55, 0.75 * h],
        ],
        [
          [0, -d * 0.7, -0.55 * h],
          [0, -d * 2.4, 0.15 * h],
          [0, -d * 0.6, -0.4 * h],
        ],
      ],
    }),
};

export const pearlGourami: AssetDefinition = {
  kind: "pearl-gourami",
  name: "Pearl gourami",
  scientificName: "Trichopodus leerii",
  group: "Fish",
  biomes: ["Tropical"],
  description:
    "A peaceful, oval fish dusted with pearly spots, feeling its way with long threadlike fins.",
  radius: 0.2,
  habitat: "water",
  swims: { speed: 0.16, depth: 0.12 },
  build: () =>
    fish({
      length: 0.25,
      depth: 0.055,
      width: 0.026,
      sections: [
        [-1, 0.35, 0.45],
        [-0.65, 0.8, 0.85],
        [-0.15, 1, 1],
        [0.35, 0.9, 0.85],
        [0.8, 0.5, 0.5],
        [1, 0.3, 0.3],
      ],
      paint: (y, z, speck) => {
        // A dark line runs back from the eye; the throat blushes orange.
        if (Math.abs(y) < 0.12 && z > -0.55) return "#3f362e";
        if (y < -0.35 && z < -0.1) return "#d98a4f";
        return speck < 0.3 ? "#f1e9d6" : "#9c8a6d";
      },
      tail: "fan",
      fin: "#b8a68a",
      fins: (d, h) => [
        // A long anal fin, a small dorsal and two trailing feelers.
        [
          [0, -d * 0.8, -0.35 * h],
          [0, -d * 1.7, 0.85 * h],
          [0, -d * 0.55, 0.85 * h],
        ],
        [
          [0, d * 0.85, 0.15 * h],
          [0, d * 1.6, 0.55 * h],
          [0, d * 0.65, 0.75 * h],
        ],
        [
          [0.008, -d * 0.6, -0.5 * h],
          [0.012, -d * 2.8, 0.6 * h],
          [0.008, -d * 0.6, -0.42 * h],
        ],
        [
          [-0.008, -d * 0.6, -0.5 * h],
          [-0.012, -d * 2.8, 0.6 * h],
          [-0.008, -d * 0.6, -0.42 * h],
        ],
      ],
    }),
};

export const rainbowShark: AssetDefinition = {
  kind: "rainbow-shark",
  name: "Rainbow shark",
  scientificName: "Epalzeorhynchos frenatum",
  group: "Fish",
  biomes: ["Tropical"],
  description:
    "Not a shark at all: a sleek black minnow with bright red fins that patrols low over the bottom.",
  radius: 0.2,
  habitat: "water",
  // Deeper than any pool, so it keeps just above the bottom.
  swims: { speed: 0.3, depth: 4 },
  build: () =>
    fish({
      length: 0.27,
      depth: 0.04,
      width: 0.03,
      sections: [
        [-1, 0.3, 0.45],
        [-0.7, 0.75, 0.8],
        [-0.2, 1, 1],
        [0.3, 0.8, 0.8],
        [0.75, 0.4, 0.45],
        [1, 0.22, 0.25],
      ],
      paint: (y) => (y < -0.5 ? "#3a3c3d" : "#1d2022"),
      tail: "forked",
      fin: "#d4402c",
      fins: (d, h) => [
        // A tall, pointed dorsal fin like a shark's.
        [
          [0, d * 0.9, -0.35 * h],
          [0, d * 2.6, -0.05 * h],
          [0, d * 0.85, 0.15 * h],
        ],
        [
          [0, -d * 0.8, 0.2 * h],
          [0, -d * 1.7, 0.45 * h],
          [0, -d * 0.7, 0.55 * h],
        ],
        [
          [0.02, -d * 0.7, -0.4 * h],
          [0.05, -d * 1.4, -0.15 * h],
          [0.02, -d * 0.6, -0.15 * h],
        ],
        [
          [-0.02, -d * 0.7, -0.4 * h],
          [-0.05, -d * 1.4, -0.15 * h],
          [-0.02, -d * 0.6, -0.15 * h],
        ],
      ],
    }),
};

export const corydoras: AssetDefinition = {
  kind: "corydoras",
  name: "Bronze corydoras",
  scientificName: "Corydoras aeneus",
  group: "Fish",
  biomes: ["Tropical"],
  description:
    "A small armored catfish that roots through the sand in busy little groups. Add several.",
  radius: 0.1,
  habitat: "water",
  swims: { speed: 0.12, depth: 4 },
  build: () =>
    fish({
      length: 0.11,
      depth: 0.03,
      width: 0.022,
      sections: [
        [-1, 0.5, 0.55],
        [-0.7, 0.95, 0.85],
        [-0.2, 1, 1],
        [0.3, 0.75, 0.75],
        [0.75, 0.4, 0.4],
        [1, 0.25, 0.25],
      ],
      paint: (y) => {
        if (y > 0.35) return "#4f6448";
        if (y > -0.3) return "#8d6a3c";
        return "#d8c7a4";
      },
      tail: "forked",
      fin: "#c4b08a",
      fins: (d, h) => [
        [
          [0, d * 0.9, -0.3 * h],
          [0, d * 2.2, -0.1 * h],
          [0, d * 0.85, 0.1 * h],
        ],
        // Whiskers under the snout.
        [
          [0, -d * 0.35, -0.95 * h],
          [0, -d * 0.95, -1.15 * h],
          [0, -d * 0.5, -0.9 * h],
        ],
      ],
    }),
};

export const cutthroatTrout: AssetDefinition = {
  kind: "cutthroat-trout",
  name: "Cutthroat trout",
  scientificName: "Oncorhynchus clarkii",
  group: "Fish",
  biomes: ["Temperate"],
  description:
    "A young mountain trout, olive and black-spotted with a red slash under the jaw. It holds in the current and darts after drifting insects.",
  radius: 0.25,
  habitat: "water",
  swims: { speed: 0.32, depth: 0.3 },
  build: () =>
    fish({
      length: 0.32,
      depth: 0.04,
      width: 0.026,
      sections: [
        [-1, 0.35, 0.45],
        [-0.7, 0.8, 0.8],
        [-0.25, 1, 1],
        [0.25, 0.9, 0.85],
        [0.7, 0.5, 0.5],
        [1, 0.28, 0.3],
      ],
      paint: (y, z, speck) => {
        if (y < -0.45 && z < -0.6) return "#c8392b";
        if (y < -0.4) return "#e6dcc4";
        // Black spots crowd toward the tail.
        if (speck < 0.04 + Math.max(0, z) * 0.12) return "#1f2120";
        if (y > 0.3) return "#5a6236";
        return y > -0.1 ? "#9a9a64" : "#c99a86";
      },
      tail: "forked",
      fin: "#8a8458",
      fins: (d, h) => [
        [
          [0, d * 0.9, -0.3 * h],
          [0, d * 2, -0.05 * h],
          [0, d * 0.9, 0.1 * h],
        ],
        // The small fleshy adipose fin of trout and salmon.
        [
          [0, d * 0.6, 0.55 * h],
          [0, d * 1.1, 0.68 * h],
          [0, d * 0.5, 0.75 * h],
        ],
        [
          [0, -d * 0.8, 0.3 * h],
          [0, -d * 1.7, 0.5 * h],
          [0, -d * 0.7, 0.6 * h],
        ],
      ],
    }),
};

export const sculpin: AssetDefinition = {
  kind: "sculpin",
  name: "Mottled sculpin",
  scientificName: "Cottus bairdii",
  group: "Fish",
  biomes: ["Temperate"],
  description:
    "A big-headed, mottled little fish that hugs the stream bed and hides among the stones.",
  radius: 0.14,
  habitat: "water",
  swims: { speed: 0.08, depth: 4 },
  build: () =>
    fish({
      length: 0.15,
      depth: 0.025,
      width: 0.032,
      // A broad, flat head that rounds to a blunt snout, then a body
      // tapering to the tail.
      sections: [
        [-1, 0.3, 0.45],
        [-0.85, 0.7, 1],
        [-0.6, 0.95, 1.15],
        [-0.25, 0.9, 0.9],
        [0.3, 0.65, 0.55],
        [0.75, 0.4, 0.3],
        [1, 0.3, 0.2],
      ],
      paint: (y, z, speck) => {
        if (y < -0.4) return "#cdbf9a";
        const blotch = Math.sin(z * 9 + speck * 2) > 0.3;
        return blotch ? "#3f3a2c" : "#7d7152";
      },
      tail: "fan",
      fin: "#6b6247",
      // Its eyes sit high on the flat head, looking up from the stream bed.
      eyes: [0.45, 0.8],
      fins: (d, h) => [
        // A long, low dorsal fin and broad fanlike pectorals.
        [
          [0, d * 0.85, -0.4 * h],
          [0, d * 1.8, 0.1 * h],
          [0, d * 0.7, 0.7 * h],
        ],
        [
          [0.025, -d * 0.4, -0.5 * h],
          [0.075, -d * 0.6, -0.2 * h],
          [0.025, -d * 0.5, -0.1 * h],
        ],
        [
          [-0.025, -d * 0.4, -0.5 * h],
          [-0.075, -d * 0.6, -0.2 * h],
          [-0.025, -d * 0.5, -0.1 * h],
        ],
      ],
    }),
};

export const convictCichlid: AssetDefinition = {
  kind: "convict-cichlid",
  name: "Convict cichlid",
  scientificName: "Amatitlania nigrofasciata",
  group: "Fish",
  biomes: ["Tropical"],
  description:
    "A bold little Central American cichlid, pale grey crossed with black bars. Pairs guard their patch of stream bed.",
  radius: 0.18,
  habitat: "water",
  swims: { speed: 0.2, depth: 0.8 },
  build: () =>
    fish({
      length: 0.17,
      depth: 0.05,
      width: 0.022,
      // One ring per bar, so each bar is a clean band around the body.
      sections: [
        [-1, 0.35, 0.45],
        [-0.8, 0.65, 0.7],
        [-0.6, 0.85, 0.88],
        [-0.4, 0.97, 0.97],
        [-0.2, 1, 1],
        [0, 0.98, 0.97],
        [0.2, 0.9, 0.88],
        [0.4, 0.76, 0.74],
        [0.6, 0.58, 0.56],
        [0.8, 0.42, 0.4],
        [1, 0.3, 0.3],
      ],
      paint: (y, z) => {
        if (y < -0.6) return "#c9c9bf";
        return Math.floor((z + 1) / 0.2) % 2 ? "#262626" : "#b8bab3";
      },
      tail: "fan",
      fin: "#8f9089",
      fins: (d, h) => [
        [
          [0, d * 0.95, -0.4 * h],
          [0, d * 1.7, 0.4 * h],
          [0, d * 0.7, 0.85 * h],
        ],
        [
          [0, -d * 0.85, 0.05 * h],
          [0, -d * 1.6, 0.55 * h],
          [0, -d * 0.6, 0.8 * h],
        ],
      ],
    }),
};

export const harlequinRasbora: AssetDefinition = {
  kind: "harlequin-rasbora",
  name: "Harlequin rasbora",
  scientificName: "Trigonostigma heteromorpha",
  group: "Fish",
  biomes: ["Tropical"],
  description:
    "A small copper-pink fish with a black wedge on its side. Schools through the shaded streams of Southeast Asia.",
  radius: 0.1,
  habitat: "water",
  swims: { speed: 0.22, depth: 0.15 },
  build: () =>
    fish({
      length: 0.1,
      depth: 0.025,
      width: 0.012,
      sections: [
        [-1, 0.35, 0.45],
        [-0.65, 0.85, 0.85],
        [-0.15, 1, 1],
        [0.35, 0.8, 0.8],
        [0.8, 0.4, 0.4],
        [1, 0.25, 0.25],
      ],
      paint: (y, z) => {
        // The black wedge narrows from mid-body back to the tail.
        if (z > -0.15 && Math.abs(y) < 0.9 - (z + 0.15) * 0.75)
          return "#1d1a1c";
        return y < -0.3 ? "#e8b9a0" : "#d9805a";
      },
      tail: "forked",
      fin: "#d47a52",
      fins: (d, h) => [
        [
          [0, d * 0.9, -0.15 * h],
          [0, d * 2, 0.05 * h],
          [0, d * 0.85, 0.25 * h],
        ],
      ],
    }),
};

export const pupfish: AssetDefinition = {
  kind: "pupfish",
  name: "Amargosa pupfish",
  scientificName: "Cyprinodon nevadensis",
  group: "Fish",
  biomes: ["Desert"],
  description:
    "A chunky little fish from desert springs. Breeding males turn bright blue and chase each other around the pool.",
  radius: 0.1,
  habitat: "water",
  swims: { speed: 0.18, depth: 0.5 },
  build: () =>
    fish({
      length: 0.09,
      depth: 0.026,
      width: 0.016,
      sections: [
        [-1, 0.45, 0.5],
        [-0.65, 0.9, 0.9],
        [-0.15, 1, 1],
        [0.35, 0.85, 0.8],
        [0.8, 0.5, 0.45],
        [1, 0.35, 0.3],
      ],
      paint: (y) => (y < -0.4 ? "#c7cfd6" : "#4a7fc0"),
      tail: "fan",
      // The tail fin ends in a dark band.
      fin: "#2b3f66",
      fins: (d, h) => [
        [
          [0, d * 0.95, -0.2 * h],
          [0, d * 1.9, 0.15 * h],
          [0, d * 0.85, 0.4 * h],
        ],
      ],
    }),
};

interface FishSpec {
  /** Snout to the base of the tail, facing -Z. */
  length: number;
  /** Half the body's depth and width at its deepest. */
  depth: number;
  width: number;
  /** Cross sections: position along the body (-1 snout, 1 tail) with depth
   * and width as fractions of the deepest. */
  sections: [number, number, number][];
  /** A face's color from its height (-1 belly to 1 back) and position along
   * the body, with a steady per-face number for speckles. */
  paint(y: number, z: number, speck: number): string;
  tail: "forked" | "fan";
  fin: string;
  /** Fins as triangles, from the deepest half-depth and half-length. */
  fins(depth: number, half: number): Point[][];
  /** Where the eyes sit, as fractions of the deepest half-width and
   * half-depth. Most fish see from the sides. */
  eyes?: [number, number];
}

/** A faceted fish body painted face by face, with a tail on its own group so
 * it can sway, and dark eyes. */
function fish(spec: FishSpec) {
  const root = new THREE.Group();
  const half = spec.length / 2;
  const rings = spec.sections.map(([t, depth, width]) =>
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
  for (let i = 0; i < position.count; i += 3) {
    let y = 0,
      z = 0;
    for (let k = 0; k < 3; k++) {
      y += position.getY(i + k) / 3;
      z += position.getZ(i + k) / 3;
    }
    const speck = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const color = new THREE.Color(spec.paint(y / spec.depth, z / half, speck));
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
  // Tall-bodied fish like angelfish keep a modest tail.
  const t = Math.min(spec.depth, spec.length * 0.25) * 1.5;
  const outline: Point[] =
    spec.tail === "forked"
      ? [
          [0, 0, 0],
          [0, t, t * 1.3],
          [0, t * 0.25, t * 0.9],
          [0, 0, t * 0.6],
          [0, -t * 0.25, t * 0.9],
          [0, -t, t * 1.3],
        ]
      : [
          [0, 0, 0],
          [0, t * 0.8, t * 0.9],
          [0, t * 0.45, t * 1.35],
          [0, 0, t * 1.45],
          [0, -t * 0.45, t * 1.35],
          [0, -t * 0.8, t * 0.9],
        ];
  mesh(triangles(outline, [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]), fin, tail);
  for (const points of spec.fins(spec.depth, half))
    mesh(triangles(points, [0, 1, 2]), fin, root);
  const dark = material("#141a18", 0.3);
  const [eyeX, eyeY] = spec.eyes ?? [0.7, 0.25];
  for (const side of [-1, 1]) {
    const eye = mesh(
      new THREE.IcosahedronGeometry(spec.depth * 0.2, 0),
      dark,
      root,
      [side * spec.width * eyeX, spec.depth * eyeY, -0.72 * half],
    );
    eye.scale.x = 0.5;
  }
  return root;
}
