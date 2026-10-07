import * as THREE from "three";
import type { AssetDefinition } from "../types";
import { buildSkinned, type Painter } from "../skinned";
import geckoModel from "./gecko.json";

export const gecko: AssetDefinition = {
  kind: "gecko",
  name: "Gold dust day gecko",
  scientificName: "Phelsuma laticauda",
  group: "Reptiles",
  biomes: ["Tropical"],
  description:
    "A bright green day gecko flecked with gold, quick on glass and broad leaves.",
  radius: 0.45,
  habitat: "land",
  behavior: {
    nocturnal: false,
    climbs: true,
    speed: 0.07,
    movement: "scurry",
    restsOn: ["glass", "bark", "leaf"],
  },
  build: (random) => buildLizard(paintGecko, random),
};

export const leopardLizard: AssetDefinition = {
  kind: "leopard-lizard",
  name: "Long-nosed leopard lizard",
  scientificName: "Gambelia wislizenii",
  group: "Reptiles",
  biomes: ["Desert"],
  description:
    "A sandy desert lizard dotted with dark spots, a fast sprinter that hunts in the open.",
  radius: 0.45,
  habitat: "land",
  behavior: {
    nocturnal: false,
    climbs: false,
    speed: 0.09,
    movement: "scurry",
    restsOn: ["stone", "ground"],
  },
  build: (random) => buildLizard(paintLeopardLizard, random),
};

export const desertSpinyLizard: AssetDefinition = {
  kind: "desert-spiny-lizard",
  name: "Desert spiny lizard",
  scientificName: "Sceloporus magister",
  group: "Reptiles",
  biomes: ["Desert"],
  description:
    "A heavy, spiny-scaled lizard, dark with yellow bands and a black collar, that climbs rock and wood to bask.",
  radius: 0.45,
  habitat: "land",
  behavior: {
    nocturnal: false,
    climbs: true,
    speed: 0.075,
    movement: "scurry",
    restsOn: ["stone", "bark"],
  },
  build: (random) => buildLizard(paintSpinyLizard, random),
};

export const fenceLizard: AssetDefinition = {
  kind: "fence-lizard",
  name: "Plateau fence lizard",
  scientificName: "Sceloporus tristichus",
  group: "Reptiles",
  biomes: ["Temperate", "Desert"],
  description:
    "A grey-brown mountain lizard with pale side stripes, dark chevrons and a blue-washed belly, quick up rock and bark.",
  radius: 0.45,
  habitat: "land",
  behavior: {
    nocturnal: false,
    climbs: true,
    speed: 0.08,
    movement: "scurry",
    restsOn: ["stone", "bark"],
  },
  build: (random) => buildLizard(paintFenceLizard, random),
};

export const tigerSalamander: AssetDefinition = {
  kind: "tiger-salamander",
  name: "Western tiger salamander",
  scientificName: "Ambystoma mavortium",
  group: "Amphibians",
  biomes: ["Temperate"],
  description:
    "A stout, slow salamander, dark olive blotched with yellow. It spends the day under logs and stones and hunts at night.",
  radius: 0.45,
  habitat: "land",
  behavior: {
    nocturnal: true,
    climbs: false,
    speed: 0.03,
    movement: "crawl",
    restsOn: ["ground", "bark", "stone"],
  },
  build: (random) => buildLizard(paintTigerSalamander, random),
};

export const chuckwalla: AssetDefinition = {
  kind: "chuckwalla",
  name: "Common chuckwalla",
  scientificName: "Sauromalus ater",
  group: "Reptiles",
  biomes: ["Desert"],
  description:
    "A big, easygoing desert lizard with a dark body and a rusty tail. It basks on rocks and grazes on flowers and leaves.",
  radius: 0.45,
  habitat: "land",
  behavior: {
    nocturnal: false,
    climbs: false,
    speed: 0.035,
    movement: "crawl",
    restsOn: ["stone"],
    grazes: true,
  },
  build: (random) => buildLizard(paintChuckwalla, random),
};

/** Every species built on the lizard model, which the gecko rig animates. */
export const lizardKinds = new Set<string>([
  gecko.kind,
  leopardLizard.kind,
  desertSpinyLizard.kind,
  fenceLizard.kind,
  tigerSalamander.kind,
  chuckwalla.kind,
]);

/** The source model's palette, by role. */
const BACK = "98e043",
  UNDERSIDE = "ddcec7",
  TOES = "d3bfb4",
  EYE = "d69f8a";

/** Model: "Salamander" by Poly by Google, CC-BY 3.0, recolored per species.
 * scripts/prepare-gecko-model.mjs bakes the mesh, skeleton and skin weights. */
function buildLizard(paint: Painter, random: () => number) {
  return buildSkinned(geckoModel, paint, random, EYE);
}

/** Bright green above with gold flecks across the neck and shoulders and red
 * bars on the lower back, a pale yellow belly, and glossy dark eyes. */
function paintGecko(source: string, at: THREE.Vector3, flecks: number) {
  if (source === EYE) return new THREE.Color("#16130f");
  if (source === TOES) return new THREE.Color("#9fbd63");
  if (source === UNDERSIDE) return new THREE.Color("#d8dc9a");
  if (source !== BACK) throw new Error(`Unexpected gecko color ${source}.`);
  const noise = Math.sin(at.x * 310 + at.z * 170 + flecks) * 0.5 + 0.5;
  if (at.z > -0.27 && at.z < -0.1 && noise > 0.82)
    return new THREE.Color("#e6c645");
  const midline = Math.abs(at.x) < 0.035;
  if (midline && at.z > -0.02 && at.z < 0.13 && Math.sin(at.z * 80) > 0.4)
    return new THREE.Color("#cf4a2c");
  return new THREE.Color("#56b93a");
}

/** Sandy tan above, scattered with dark brown spots that run down the tail,
 * a cream belly and throat, and yellowish toes. */
function paintLeopardLizard(source: string, at: THREE.Vector3, flecks: number) {
  if (source === EYE) return new THREE.Color("#16130f");
  if (source === TOES) return new THREE.Color("#c9a35c");
  if (source === UNDERSIDE) return new THREE.Color("#e6dcc4");
  if (source !== BACK) throw new Error(`Unexpected lizard color ${source}.`);
  const noise = Math.sin(at.x * 260 + at.z * 190 + flecks) * 0.5 + 0.5;
  if (noise > 0.8) return new THREE.Color("#4a3523");
  return new THREE.Color("#b99a6b");
}

/** Dark scales with broken yellow bands across the back, a black collar, a
 * grey head and a ringed tail. */
function paintSpinyLizard(source: string, at: THREE.Vector3, flecks: number) {
  if (source === EYE) return new THREE.Color("#16130f");
  if (source === TOES) return new THREE.Color("#4a4236");
  if (source === UNDERSIDE) return new THREE.Color("#8f8775");
  if (source !== BACK) throw new Error(`Unexpected lizard color ${source}.`);
  if (at.z < -0.27) return new THREE.Color("#77705f");
  if (at.z < -0.22) return new THREE.Color("#1c1915");
  if (at.z > 0.13)
    return new THREE.Color(Math.sin(at.z * 60) > 0 ? "#5c503d" : "#2c261e");
  const noise = Math.sin(at.x * 230 + at.z * 150 + flecks) * 0.5 + 0.5;
  if (Math.abs(at.x) < 0.05 && Math.sin(at.z * 70) > 0.4 && noise > 0.35)
    return new THREE.Color("#d4ae38");
  return new THREE.Color(noise > 0.75 ? "#5e523f" : "#3a3127");
}

/** Grey-brown with a pale stripe down each side of the back and dark
 * chevrons between them. */
function paintFenceLizard(source: string, at: THREE.Vector3, flecks: number) {
  if (source === EYE) return new THREE.Color("#16130f");
  if (source === TOES) return new THREE.Color("#6d6455");
  if (source === UNDERSIDE) return new THREE.Color("#7f8c99");
  if (source !== BACK) throw new Error(`Unexpected lizard color ${source}.`);
  const side = Math.abs(at.x);
  if (side > 0.035 && side < 0.05 && at.z < 0.13)
    return new THREE.Color("#c4b89c");
  if (side < 0.035 && Math.sin(at.z * 90 + side * 60 + flecks) > 0.55)
    return new THREE.Color("#3b3229");
  return new THREE.Color("#7b7161");
}

/** Dark olive with irregular yellow blotches, and a dull yellow belly. */
function paintTigerSalamander(
  source: string,
  at: THREE.Vector3,
  flecks: number,
) {
  if (source === EYE) return new THREE.Color("#16130f");
  if (source === TOES) return new THREE.Color("#5b5a3a");
  if (source === UNDERSIDE) return new THREE.Color("#b9a650");
  if (source !== BACK)
    throw new Error(`Unexpected salamander color ${source}.`);
  const blotch =
    Math.sin(at.x * 70 + flecks) * Math.cos(at.z * 55 + flecks * 1.7) +
    0.4 * Math.sin(at.z * 130 - at.x * 40);
  if (blotch > 0.55) return new THREE.Color("#d2b23c");
  return new THREE.Color("#3a3d29");
}

/** A dark body from head to hips, flecked with grey, and a rusty orange
 * tail that pales toward the tip, as on a male. */
function paintChuckwalla(source: string, at: THREE.Vector3, flecks: number) {
  if (source === EYE) return new THREE.Color("#16130f");
  if (source === TOES) return new THREE.Color("#3a3430");
  const noise = Math.sin(at.x * 240 + at.z * 210 + flecks) * 0.5 + 0.5;
  // Where the tail begins behind the hips, with a ragged edge.
  const tail = THREE.MathUtils.smoothstep(
    at.z + (noise - 0.5) * 0.06,
    0.08,
    0.17,
  );
  if (source === UNDERSIDE)
    return new THREE.Color("#3c3833").lerp(new THREE.Color("#a08a6c"), tail);
  if (source !== BACK)
    throw new Error(`Unexpected chuckwalla color ${source}.`);
  const orange = new THREE.Color("#a8653a").lerp(
    new THREE.Color("#c4a074"),
    THREE.MathUtils.smoothstep(at.z, 0.2, 0.4),
  );
  const tone = new THREE.Color("#2e2925").lerp(orange, tail);
  return noise > 0.9 ? tone.lerp(new THREE.Color("#8b8378"), 0.4) : tone;
}
