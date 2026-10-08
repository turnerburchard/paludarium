import * as THREE from "three";
import type { AssetDefinition } from "../types";
import { buildSkinned } from "../skinned";
import crabModel from "./vampireCrab.json";
import scorpionModel from "./scorpion.json";
import tarantulaModel from "./tarantula.json";
import microCrabModel from "./microCrab.json";
import crayfishModel from "./crayfish.json";
import shrimpModel from "./cherryShrimp.json";

// scripts/prepare-arthropod-models.mjs bakes these models, fitting bones to
// each leg and listing which legs step together.

export const vampireCrab: AssetDefinition = {
  kind: "vampire-crab",
  name: "Vampire crab",
  scientificName: "Geosesarma dennerle",
  group: "Invertebrates",
  biomes: ["Tropical"],
  description:
    "A tiny purple land crab with bright yellow eyes that hides by day, picks at the ground at night, and wanders into shallow water.",
  radius: 0.21,
  habitat: "land",
  behavior: {
    nocturnal: true,
    climbs: false,
    speed: 0.05,
    movement: "scurry",
    restsOn: ["stone", "bark"],
    water: "visits",
  },
  build: (random) =>
    buildSkinned(crabModel, paintVampireCrab, random, CRAB_EYE),
};

export const scorpion: AssetDefinition = {
  kind: "stripe-tailed-scorpion",
  name: "Stripe-tailed scorpion",
  scientificName: "Paravaejovis spinigerus",
  group: "Invertebrates",
  biomes: ["Desert"],
  description:
    "A small straw-colored scorpion with a striped tail that shelters under stone and hunts at night.",
  radius: 0.22,
  habitat: "land",
  behavior: {
    nocturnal: true,
    climbs: false,
    speed: 0.05,
    movement: "scurry",
    restsOn: ["stone"],
  },
  build: (random) => buildSkinned(scorpionModel, paintScorpion, random),
};

export const tarantula: AssetDefinition = {
  kind: "desert-tarantula",
  name: "Desert blonde tarantula",
  scientificName: "Aphonopelma chalcodes",
  group: "Invertebrates",
  biomes: ["Desert"],
  description:
    "A big, gentle, golden-haired tarantula with a dark abdomen that wanders slowly after dusk.",
  radius: 0.22,
  habitat: "land",
  behavior: {
    nocturnal: true,
    climbs: false,
    speed: 0.03,
    movement: "crawl",
    restsOn: ["stone", "ground"],
  },
  build: (random) => buildSkinned(tarantulaModel, paintTarantula, random),
};

export const microCrab: AssetDefinition = {
  kind: "micro-crab",
  name: "Thai micro crab",
  scientificName: "Limnopilos naiyanetri",
  group: "Invertebrates",
  biomes: ["Tropical"],
  description:
    "A fingernail-sized, almost see-through crab that lives its whole life underwater, sifting food from the water among roots and stones.",
  radius: 0.12,
  habitat: "water",
  behavior: {
    nocturnal: true,
    climbs: false,
    speed: 0.035,
    movement: "scurry",
    restsOn: ["stone", "bark"],
    grazes: true,
    water: "lives",
  },
  build: (random) =>
    buildSkinned(microCrabModel, paintMicroCrab, random, CRAB_EYE, 0.7),
};

export const dwarfCrayfish: AssetDefinition = {
  kind: "dwarf-crayfish",
  name: "Mexican dwarf crayfish",
  scientificName: "Cambarellus patzcuarensis",
  group: "Invertebrates",
  biomes: ["Temperate", "Tropical"],
  description:
    "A small, bright orange crayfish that picks over the bottom for scraps and backs into cover under stone and wood.",
  radius: 0.14,
  habitat: "water",
  behavior: {
    nocturnal: false,
    climbs: false,
    speed: 0.04,
    movement: "crawl",
    restsOn: ["stone", "bark"],
    grazes: true,
    water: "lives",
  },
  build: (random) =>
    buildSkinned(crayfishModel, paintCrayfish, random, CRAYFISH_EYE),
};

export const cherryShrimp: AssetDefinition = {
  kind: "cherry-shrimp",
  name: "Cherry shrimp",
  scientificName: "Neocaridina davidi",
  group: "Invertebrates",
  biomes: ["Tropical", "Temperate"],
  description:
    "A tiny red freshwater shrimp that spends all day picking algae and biofilm off stones, wood and leaves.",
  radius: 0.11,
  habitat: "water",
  behavior: {
    nocturnal: false,
    climbs: false,
    speed: 0.03,
    movement: "crawl",
    restsOn: ["stone", "bark"],
    grazes: true,
    water: "lives",
  },
  build: (random) => buildSkinned(shrimpModel, paintShrimp, random, SHRIMP_EYE),
};

/** Legs and arms per kind, for ArthropodRig. Crabs wave their claws as
 * they go; the scorpion's pincers and the spider's palps stay low. */
export const arthropodRigs = new Map([
  [vampireCrab.kind, { ...crabModel, wave: 0.35 }],
  [scorpion.kind, { ...scorpionModel, wave: 0 }],
  [tarantula.kind, { ...tarantulaModel, wave: 0 }],
  [microCrab.kind, { ...microCrabModel, wave: 0, stride: 0.012 }],
  [dwarfCrayfish.kind, { ...crayfishModel, wave: 0, stride: 0.012 }],
  [cherryShrimp.kind, { ...shrimpModel, wave: 0, stride: 0.007 }],
]);

/** Model: "Crab" by jeremy, CC-BY 3.0. One red for the shell, legs and
 * claws, white under the shell and inside the claws, and black eyes. It
 * faces -X, so it walks sideways. */
const CRAB_SHELL = "f53f30",
  CRAB_UNDER = "ffffff",
  CRAB_EYE = "191919";

/** A dark plum-brown shell over dusky purple legs, claws that fade from
 * mauve to cream at the tips, and yellow eyes on dark stalks. */
function paintVampireCrab(source: string, at: THREE.Vector3) {
  if (source === CRAB_EYE) return new THREE.Color("#e6b83a");
  if (source === CRAB_UNDER) return new THREE.Color("#b9a48f");
  if (source !== CRAB_SHELL)
    throw new Error(`Unexpected crab color ${source}.`);
  if (at.y > 0.12) return new THREE.Color("#3a2a36");
  const claw = at.x < -0.06 && Math.abs(at.z) > 0.04;
  if (claw) {
    if (at.x < -0.16) return new THREE.Color("#d9c8b2");
    return new THREE.Color(at.x < -0.12 ? "#9c7a82" : "#6e4a5e");
  }
  const shell = Math.abs(at.z) < 0.11 && at.y > 0.03;
  return new THREE.Color(shell ? "#3b2b33" : "#4e3647");
}

/** Model: "Scorpion" by Poly by Google, CC-BY 3.0, with its pincers
 * shortened. Its palette is legs, body and tail, dark tips, and pincers. */
const SCORPION_LEGS = "9f5524",
  SCORPION_BODY = "7d371e",
  SCORPION_TIPS = "261a0a",
  SCORPION_PINCERS = "773b17";

/** Straw yellow with pale legs, dark bands down the tail, and a dark sting
 * and pincer tips. */
function paintScorpion(source: string, at: THREE.Vector3) {
  if (source === SCORPION_TIPS) return new THREE.Color("#3d2a17");
  if (source === SCORPION_LEGS) return new THREE.Color("#c9a46a");
  if (source === SCORPION_PINCERS) return new THREE.Color("#a8783f");
  if (source !== SCORPION_BODY)
    throw new Error(`Unexpected scorpion color ${source}.`);
  const tail = at.z > 0.09;
  if (tail && Math.sin(at.z * 120) > 0.5) return new THREE.Color("#5a3b1e");
  return new THREE.Color(tail ? "#a9803f" : "#97703a");
}

/** Model: "Spider" by Quaternius, CC0, with stouter, shorter legs and
 * without its eyes. It is one grey throughout. */
const SPIDER = "3a3a3a";

/** Golden blonde over the head and legs with darker feet, and a chocolate
 * abdomen with a few reddish hairs. */
function paintTarantula(source: string, at: THREE.Vector3, flecks: number) {
  if (source !== SPIDER) throw new Error(`Unexpected spider color ${source}.`);
  const hair = Math.sin(at.x * 410 + at.y * 230 + at.z * 330 + flecks);
  if (at.z > 0.02 && Math.abs(at.x) < 0.07 && at.y > 0.02)
    return new THREE.Color(hair > 0.7 ? "#7a4c2e" : "#3d2a1f");
  if (at.y < 0.02) return new THREE.Color("#6b4d31");
  return new THREE.Color(hair > 0.6 ? "#d6b67d" : "#b8925c");
}

/** Glassy pink-grey, built see-through, with dark eyes. */
function paintMicroCrab(source: string) {
  if (source === CRAB_EYE) return new THREE.Color("#1f1d19");
  if (source === CRAB_UNDER) return new THREE.Color("#e3cfd0");
  if (source !== CRAB_SHELL)
    throw new Error(`Unexpected crab color ${source}.`);
  return new THREE.Color("#c39ea4");
}

/** Model: "Crayfish" by Poly by Google, CC-BY 3.0. Its palette is a red
 * shell, pale joints and black eyes. */
const CRAYFISH_SHELL = "b83321",
  CRAYFISH_PALE = "ffcfc8",
  CRAYFISH_EYE = "1b0c0a";

/** Bright orange with darker bands across the tail and claw tips, and
 * pale orange joints. */
function paintCrayfish(source: string, at: THREE.Vector3) {
  if (source === CRAYFISH_EYE) return new THREE.Color("#1a0f0a");
  if (source === CRAYFISH_PALE) return new THREE.Color("#f2b071");
  if (source !== CRAYFISH_SHELL)
    throw new Error(`Unexpected crayfish color ${source}.`);
  const tail = at.z > 0.04;
  if (tail && Math.sin(at.z * 150) > 0.6) return new THREE.Color("#c4520f");
  return new THREE.Color("#ec7a1c");
}

/** Model: "Crayfish" by Poly by Google, CC-BY 3.0, used as a shrimp. It is
 * one grey throughout, so the bake picks out its eyes. */
const SHRIMP = "bcbcbc",
  SHRIMP_EYE = "000000";

/** Cherry red over the back and paler toward the legs. */
function paintShrimp(source: string, at: THREE.Vector3, flecks: number) {
  if (source === SHRIMP_EYE) return new THREE.Color("#120707");
  if (source !== SHRIMP) throw new Error(`Unexpected shrimp color ${source}.`);
  if (at.y < 0.015) return new THREE.Color("#d9776b");
  const speckle = Math.sin(at.x * 380 + at.z * 290 + flecks);
  return new THREE.Color(speckle > 0.75 ? "#e0473a" : "#bf2419");
}
