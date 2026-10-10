import * as THREE from "three";
import { material, mesh } from "../geometry";
import { triangles, type Point } from "../faceted";
import type { AssetDefinition } from "../types";

export const duckweed: AssetDefinition = {
  kind: "duckweed",
  name: "Duckweed",
  scientificName: "Lemna minor",
  group: "Aquatic plants",
  biomes: ["Tropical", "Temperate"],
  description:
    "Tiny round leaves in twos and threes that drift together into a green skin over still water.",
  radius: 0.42,
  habitat: "water",
  floats: true,
  build,
};

const GREENS = ["#6f9a3a", "#77a13f", "#7fa845"];

function build(random: () => number) {
  const root = new THREE.Group();
  const greens = GREENS.map((color) => material(color, 0.6));
  // A few broad lobes, so the drift's edge wanders instead of making a disc.
  const lobes = 2 + Math.floor(random() * 3);
  const phase = random() * Math.PI * 2;
  const clumps = 55;
  for (let i = 0; i < clumps; i++) {
    const angle = random() * Math.PI * 2;
    const reach = 0.38 * (0.7 + 0.3 * Math.sin(angle * lobes + phase));
    // Denser toward the middle, thinning out at the edge.
    const distance = Math.sqrt(random()) * reach;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const color = greens[Math.floor(random() * greens.length)];
    // A clump is a few fronds budding off one another in a rough fan.
    const fronds = 2 + Math.floor(random() * 3);
    let heading = random() * Math.PI * 2;
    for (let f = 0; f < fronds; f++) {
      const length = 0.035 + random() * 0.02;
      const offset = f === 0 ? 0 : length * 0.75;
      const leaf = mesh(frond(length, length * 0.72), color, root, [
        x + Math.cos(heading) * offset,
        // Clear of the water's ripples, which rise up to 0.008, and stacked
        // a hair apart so overlapping fronds never flicker.
        0.011 + (i / clumps) * 0.003 + f * 0.0005,
        z + Math.sin(heading) * offset,
      ]);
      leaf.rotation.y = -heading;
      heading += 1.2 + random() * 1.6;
    }
  }
  return root;
}

/** A flat oval frond with a faint dome, so light catches its facets. */
function frond(length: number, width: number): THREE.BufferGeometry {
  const sides = 7;
  const points: Point[] = [[0, length * 0.08, 0]];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    points.push([
      (Math.cos(angle) * length) / 2,
      0,
      (Math.sin(angle) * width) / 2,
    ]);
  }
  const faces = Array.from({ length: sides }, (_, i) => [
    0,
    1 + ((i + 1) % sides),
    1 + i,
  ]).flat();
  return triangles(points, faces);
}
