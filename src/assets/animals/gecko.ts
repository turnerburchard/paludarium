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
  build,
};

/** The source model's palette, by role. */
const BACK = "98e043",
  UNDERSIDE = "ddcec7",
  TOES = "d3bfb4",
  EYE = "d69f8a";

/** Model: "Salamander" by Poly by Google, CC-BY 3.0, recolored as a day gecko.
 * scripts/prepare-gecko-model.mjs bakes the mesh, skeleton and skin weights. */
function build(random: () => number) {
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
      const tone = faceColor(part.color, center, flecks);
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
function faceColor(source: string, at: THREE.Vector3, flecks: number) {
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
