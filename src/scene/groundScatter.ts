import * as THREE from "three";
import type { Environment } from "../model/schema";
import { randomFromSeed } from "../model/random";
import { groundHeight, groundNormal } from "../model/terrain";
import { paintSamples, type GroundMaterial } from "../model/terrainData";
import { grain } from "./groundSurface";

export type ScatterKind = "leaf" | "chip" | "pebble";
export interface ScatterPiece {
  kind: ScatterKind;
  matrix: THREE.Matrix4;
  color: THREE.Color;
}

/** Loose bits per square unit of ground, before the ground's material
 * decides what, if anything, lies at each spot. */
const DENSITY = 60;

/** What lies on each material, as chances out of one. Moss has its own
 * carpet, so nothing is scattered on it. */
const litter: Record<
  Exclude<GroundMaterial, "natural">,
  Partial<Record<ScatterKind, number>>
> = {
  soil: { leaf: 0.5, chip: 0.12, pebble: 0.05 },
  sand: { pebble: 0.16, leaf: 0.03 },
  stone: { pebble: 0.42 },
  moss: {},
};
const colors: Record<ScatterKind | "gravel", THREE.Color[]> = {
  leaf: ["#5c4027", "#6a492b", "#4e3823", "#5b5631", "#74512d"].map(
    (hex) => new THREE.Color(hex),
  ),
  chip: ["#3e2a1f", "#4d3426", "#33241b"].map((hex) => new THREE.Color(hex)),
  pebble: ["#c4b991", "#867c5b", "#a39570"].map((hex) => new THREE.Color(hex)),
  gravel: ["#8e9294", "#6a6e70", "#a7a9a6"].map((hex) => new THREE.Color(hex)),
};
const sizes: Record<ScatterKind, [number, number]> = {
  leaf: [0.05, 0.035],
  chip: [0.035, 0.03],
  pebble: [0.013, 0.03],
};

/** How many spots get rolled, which is also the most pieces of one kind. */
export function scatterSpots(env: { width: number; depth: number }) {
  return Math.round(env.width * env.depth * DENSITY);
}
/** The leaf litter, bark chips and pebbles lying on the ground. Spots and
 * their dice come from a fixed seed, so painting one area never reshuffles
 * the rest of the tank. */
export function groundScatter(env: Environment): ScatterPiece[] {
  const random = randomFromSeed(84);
  const count = scatterSpots(env);
  const pieces: ScatterPiece[] = [];
  const up = new THREE.Vector3(0, 1, 0),
    tilt = new THREE.Quaternion(),
    turn = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const x = (random() - 0.5) * (env.width - 0.1),
      z = (random() - 0.5) * (env.depth - 0.1),
      roll = random(),
      shade = random(),
      grow = random(),
      spin = random();
    const material = materialAt(x, z, env);
    // Litter drifts into patches with bare ground between, like real tanks.
    const drift = 0.25 + 1.8 * grain(x, z, 0.7) ** 2;
    let kind: ScatterKind | undefined,
      chance = 0;
    for (const [option, odds] of Object.entries(litter[material])) {
      chance += option === "pebble" ? odds : odds * drift;
      if (roll < chance) {
        kind = option as ScatterKind;
        break;
      }
    }
    if (!kind) continue;
    const palette = colors[material === "stone" ? "gravel" : kind];
    const [base, spread] = sizes[kind];
    const size = base + grow * spread;
    // Lay flat things along the slope. Pebbles sit upright and half sunk.
    tilt.setFromUnitVectors(up, groundNormal(x, z, env));
    turn.setFromAxisAngle(up, spin * Math.PI * 2);
    const shape = {
      pebble: new THREE.Vector3(size, size * 0.5, size),
      leaf: new THREE.Vector3(size, size, size),
      chip: new THREE.Vector3(size, size * 0.22, size * (0.3 + 0.3 * shade)),
    }[kind];
    pieces.push({
      kind,
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(x, groundHeight(x, z, env) + 0.004, z),
        tilt.clone().multiply(turn),
        shape,
      ),
      color: palette[Math.floor(shade * palette.length)],
    });
  }
  return pieces;
}

/** The material covering most of this spot, with unpainted ground counted
 * as sand on low banks and soil higher up, as the ground's colors do. */
function materialAt(x: number, z: number, env: Environment) {
  const coverage = new Map<GroundMaterial, number>();
  for (const { index, weight } of paintSamples(x, z, env)) {
    const material = env.terrain?.paint[index] ?? "natural";
    coverage.set(material, (coverage.get(material) ?? 0) + weight);
  }
  let most: GroundMaterial = "natural",
    best = 0;
  for (const [material, weight] of coverage)
    if (weight > best) [most, best] = [material, weight];
  if (most !== "natural") return most;
  const sandy = (0.55 - groundHeight(x, z, env)) * 2.3 > 0.5;
  return sandy ? "sand" : "soil";
}

/** A small curled leaf: a pointed blade folded along its midrib. */
export function makeLeafGeometry() {
  const tip = [0, 0.02, 0.5],
    stem = [0, 0.02, -0.5],
    rib = [0, 0, 0],
    left = [-0.22, 0.06, 0.02],
    right = [0.22, 0.06, -0.02];
  const triangles = [
    [tip, left, rib],
    [left, stem, rib],
    [rib, right, tip],
    [rib, stem, right],
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(triangles.flat(2), 3),
  );
  geo.computeVertexNormals();
  return geo;
}
