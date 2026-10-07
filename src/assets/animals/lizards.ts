import * as THREE from "three";
import type { AssetDefinition } from "../types";
import geckoModel from "./gecko.json";

export const gecko: AssetDefinition = {
  kind: "gecko",
  name: "Gold dust day gecko",
  scientificName: "Phelsuma laticauda",
  category: "Animals",
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
  category: "Animals",
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
  category: "Animals",
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
  category: "Animals",
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
  category: "Animals",
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
  category: "Animals",
  description:
    "A big, easygoing desert lizard with a black front and a rusty tail. It basks on rocks and grazes on flowers and leaves.",
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

/** Colors one face, given the source color of its part, its center in model
 * space, and a per-animal offset so no two animals share a pattern. */
type Painter = (
  source: string,
  at: THREE.Vector3,
  flecks: number,
) => THREE.Color;

/** The source model's palette, by role. */
const BACK = "98e043",
  UNDERSIDE = "ddcec7",
  TOES = "d3bfb4",
  EYE = "d69f8a";

/** Model: "Salamander" by Poly by Google, CC-BY 3.0, recolored per species.
 * scripts/prepare-gecko-model.mjs bakes the mesh, skeleton and skin weights. */
function buildLizard(paint: Painter, random: () => number) {
  const root = new THREE.Group();
  const bones = geckoModel.bones.map((data) => {
    const bone = new THREE.Bone();
    bone.name = data.name;
    bone.position.fromArray(data.position);
    return bone;
  });
  geckoModel.bones.forEach((data, i) =>
    (data.parent < 0 ? root : bones[data.parent]).add(bones[i]),
  );
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const flecks = random() * 100;
  const skin = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.55,
  });
  const eyes = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.15,
  });
  for (const part of geckoModel.parts) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(part.skinIndex, 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(part.skinWeight, 4),
    );
    geometry.computeVertexNormals();
    const position = geometry.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const center = new THREE.Vector3();
    const corner = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
      center.set(0, 0, 0);
      for (let k = 0; k < 3; k++)
        center.add(corner.fromBufferAttribute(position, i + k));
      center.divideScalar(3);
      const tone = paint(part.color, center, flecks);
      for (let k = 0; k < 3; k++)
        colors.set([tone.r, tone.g, tone.b], (i + k) * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.SkinnedMesh(
      geometry,
      part.color === EYE ? eyes : skin,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    mesh.bind(skeleton);
  }
  return root;
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

/** A black head and shoulders that fade through a ragged, speckled band
 * into a rusty body, paling to tan down the tail, and a grey belly. */
function paintChuckwalla(source: string, at: THREE.Vector3, flecks: number) {
  if (source === EYE) return new THREE.Color("#16130f");
  if (source === TOES) return new THREE.Color("#3a3430");
  const noise = Math.sin(at.x * 240 + at.z * 210 + flecks) * 0.5 + 0.5;
  // How far back from the dark forequarters, with a ragged edge.
  const fade = THREE.MathUtils.smoothstep(
    at.z + (noise - 0.5) * 0.16,
    -0.3,
    0.22,
  );
  if (source === UNDERSIDE)
    return new THREE.Color("#3c3833").lerp(new THREE.Color("#8f877a"), fade);
  if (source !== BACK)
    throw new Error(`Unexpected chuckwalla color ${source}.`);
  const body = new THREE.Color("#9a5a33").lerp(
    new THREE.Color("#b89a72"),
    THREE.MathUtils.smoothstep(at.z, 0.1, 0.38),
  );
  const tone = new THREE.Color("#2e2925").lerp(body, fade);
  return noise > 0.9 ? tone.lerp(new THREE.Color("#c9b99c"), 0.35) : tone;
}
