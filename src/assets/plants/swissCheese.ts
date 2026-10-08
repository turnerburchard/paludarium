import * as THREE from "three";
import { material, mesh, curvedStem, bentLeaf } from "../geometry";
import { monsteraLeaves } from "../../model/plantSurfaces";
import type { AssetDefinition } from "../types";

export const swissCheesePlant: AssetDefinition = {
  kind: "swiss-cheese-plant",
  name: "Adansonii",
  scientificName: "Monstera adansonii",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description:
    "Slender pointed leaves full of long, uneven holes, on arching stalks.",
  radius: 0.48,
  size: 0.6,
  scaleRange: [0.6, 1.5],
  habitat: "land",
  shelter: true,
  soil: "damp",
  perches: monsteraLeaves,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#507139");
  const greens = ["#2c6a3a", "#3b8346", "#347a40", "#2e6a3c"];
  for (const [i, surface] of monsteraLeaves(random).entries()) {
    curvedStem(
      root,
      surface.stem.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
      0.018,
      stem,
    );
    const leaf = mesh(
      bentLeaf(leafOutline(surface.length, random), surface.length, 0.08),
      material(greens[i % 4]),
      root,
      new THREE.Vector3(surface.tip.x, surface.tip.y, surface.tip.z),
    );
    leaf.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(
        surface.direction.x,
        surface.direction.y,
        surface.direction.z,
      ),
    );
    // A raised midrib catches the light and makes the simplified foliage read as a plant.
    curvedStem(
      leaf,
      [
        new THREE.Vector3(0, 0, 0.005),
        new THREE.Vector3(0, 0.35, 0.13),
        new THREE.Vector3(0, 0.72, 0.02),
      ],
      0.006,
      stem,
    );
  }
  return root;
}

/** A slender, lopsided leaf with a drawn-out tip and a row of long holes on
 * each side of the midrib, angled toward the tip like the side veins. */
function leafOutline(length: number, random: () => number) {
  const width = length * 0.62;
  // One half is a little broader, as real adansonii leaves are.
  const halves = [1, 0.85 + random() * 0.1];
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    width * 0.55 * halves[0],
    length * 0.05,
    width * 0.62 * halves[0],
    length * 0.5,
    0,
    length,
  );
  shape.bezierCurveTo(
    -width * 0.62 * halves[1],
    length * 0.5,
    -width * 0.55 * halves[1],
    length * 0.05,
    0,
    0,
  );
  const outline = shape.getPoints(24);
  for (const side of [1, -1]) {
    // How wide this half of the blade is at a point along the midrib.
    const halfAt = (y: number) =>
      Math.max(
        ...outline
          .filter(
            (p) => Math.sign(p.x) === side && Math.abs(p.y - y) < length * 0.06,
          )
          .map((p) => Math.abs(p.x)),
      );
    const count = 2 + Math.floor(random() * 2);
    for (let i = 0; i < count; i++) {
      const along = 0.3 + ((i + 0.5) / count) * 0.45 + (random() - 0.5) * 0.05;
      // Holes fill much of each half but stay clear of the edge and midrib.
      const half = halfAt(along * length);
      const size = 0.8 + random() * 0.2;
      const hole = new THREE.Path();
      hole.absellipse(
        side * half * 0.5,
        along * length,
        half * 0.42 * size,
        length * 0.05 * size,
        0,
        Math.PI * 2,
        true,
        side * 0.45,
      );
      shape.holes.push(hole);
    }
  }
  return shape;
}
