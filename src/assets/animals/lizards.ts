import * as THREE from "three";
import type { AssetDefinition } from "../types";
import { buildSkinned, type Painter, type SkinnedModel } from "../skinned";
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
  size: 0.9,
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
  size: 1.15,
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
  size: 0.75,
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
  size: 0.9,
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

export const crocodileNewt: AssetDefinition = {
  kind: "crocodile-newt",
  name: "Vietnamese crocodile newt",
  scientificName: "Tylototriton vietnamensis",
  group: "Amphibians",
  biomes: ["Tropical"],
  description:
    "A near-black newt with an orange ridge down its spine and a row of orange warts along each side. It lives in the limestone hills of northern Vietnam, wandering between damp moss and slow pools.",
  radius: 0.42,
  size: 0.75,
  habitat: "land",
  behavior: {
    nocturnal: true,
    climbs: false,
    speed: 0.03,
    movement: "crawl",
    restsOn: ["ground", "stone", "bark"],
    water: "visits",
  },
  build: (random) =>
    buildSkinned(knobblyModel(), paintCrocodileNewt, random, EYE),
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
  size: 1.4,
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
  crocodileNewt.kind,
  chuckwalla.kind,
]);

/** The source model's palette, by role. */
const BACK = "98e043",
  UNDERSIDE = "ddcec7",
  TOES = "d3bfb4",
  EYE = "d69f8a",
  WARTS = "warts";

/** Model: "Salamander" by Poly by Google, CC-BY 3.0, recolored per species.
 * scripts/prepare-gecko-model.mjs bakes the mesh, skeleton and skin weights. */
function buildLizard(paint: Painter, random: () => number) {
  return buildSkinned(geckoModel, paint, random, EYE);
}

let knobbly: SkinnedModel | undefined;

/** The salamander mesh with a crocodile newt's warts: a knobbly ridge down
 * the spine and tail, and a row along each flank from the head to the hips.
 * Each wart is skinned like the skin beneath it, so it moves with the body. */
function knobblyModel(): SkinnedModel {
  if (knobbly) return knobbly;
  const back = geckoModel.parts.find((part) => part.color === BACK)!;
  const faces = Array.from({ length: back.positions.length / 9 }, (_, i) => {
    const [a, b, c] = [0, 1, 2].map((corner) =>
      new THREE.Vector3().fromArray(back.positions, i * 9 + corner * 3),
    );
    return {
      center: a.clone().add(b).add(c).divideScalar(3),
      normal: new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3()),
      skinIndex: back.skinIndex.slice(i * 12, i * 12 + 4),
      skinWeight: back.skinWeight.slice(i * 12, i * 12 + 4),
    };
  });
  const warts: SkinnedModel["parts"][number] = {
    color: WARTS,
    positions: [],
    skinIndex: [],
    skinWeight: [],
  };
  /** Raises a four-sided wart on the face that best matches `score`. */
  function wart(
    candidates: typeof faces,
    score: (face: (typeof faces)[number]) => number,
    size: number,
  ) {
    if (!candidates.length) return;
    const face = candidates.reduce((best, face) =>
      score(face) > score(best) ? face : best,
    );
    const side = new THREE.Vector3(0, 0, 1).cross(face.normal).normalize();
    const along = face.normal.clone().cross(side);
    const tip = face.center.clone().addScaledVector(face.normal, size * 0.75);
    const corners = [
      side,
      along,
      side.clone().negate(),
      along.clone().negate(),
    ].map((direction) =>
      face.center
        .clone()
        .addScaledVector(direction, size)
        .addScaledVector(face.normal, -size * 0.3),
    );
    for (let i = 0; i < 4; i++) {
      for (const point of [corners[i], corners[(i + 1) % 4], tip])
        warts.positions.push(point.x, point.y, point.z);
      for (let corner = 0; corner < 3; corner++) {
        warts.skinIndex.push(...face.skinIndex);
        warts.skinWeight.push(...face.skinWeight);
      }
    }
  }
  // Bones from the root through the head and tail; the rest are limbs.
  const LIMBS = 12;
  const near = (z: number) =>
    faces.filter(
      (face) =>
        Math.abs(face.center.z - z) < 0.02 &&
        face.skinIndex[face.skinWeight.indexOf(Math.max(...face.skinWeight))] <
          LIMBS,
    );
  for (let z = -0.22; z < 0.36; z += 0.02)
    wart(
      near(z).filter(
        (face) => face.normal.y > 0.5 && Math.abs(face.center.x) < 0.025,
      ),
      (face) => face.center.y,
      z > 0.13 ? 0.01 : 0.014,
    );
  for (const flank of [-1, 1])
    for (let z = -0.33; z < 0.11; z += 0.036)
      wart(
        near(z).filter(
          (face) => face.normal.y > 0 && flank * face.normal.x > 0.35,
        ),
        (face) => flank * face.center.x + face.center.y,
        0.016,
      );
  knobbly = { ...geckoModel, parts: [...geckoModel.parts, warts] };
  return knobbly;
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

/** Near black all over, with orange warts, toes and a stripe under the
 * tail. */
function paintCrocodileNewt(source: string, at: THREE.Vector3) {
  const orange = new THREE.Color("#d8752b");
  if (source === EYE) return new THREE.Color("#16130f");
  if (source === TOES || source === WARTS) return orange;
  if (source === UNDERSIDE)
    return at.z > 0.13 ? orange : new THREE.Color("#3a2a20");
  if (source !== BACK) throw new Error(`Unexpected newt color ${source}.`);
  return new THREE.Color("#211b17");
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
