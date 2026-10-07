import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { MossSpecies } from "../../model/moss";
import { dome, mossMaterial, mossTone, sprigs, strands } from "./mosses";

const UP = new THREE.Vector3(0, 1, 0);
const THICKNESS = 0.016;

/** Grows moss over a built stone or wood model: a skin over the faces that
 * catch the light, broken into patches, with small tufts rising from it. */
export function growMoss(
  model: THREE.Group,
  species: MossSpecies,
  random: () => number,
) {
  const phase = [random(), random(), random()].map((p) => p * 10);
  // Smooth bands across the model decide where moss grows thickest, so it
  // forms patches instead of covering every upward face the same.
  const patchiness = ({ x, y, z }: THREE.Vector3) =>
    Math.sin(x * 6 + phase[0]) * Math.cos(z * 5 + phase[1]) * 0.6 +
    Math.sin(y * 7 + phase[2]) * 0.4;
  const faces: {
    corners: THREE.Vector3[];
    normal: THREE.Vector3;
    growth: number;
  }[] = [];
  model.updateMatrixWorld(true);
  model.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    const position = part.geometry.getAttribute("position");
    for (let i = 0; i + 2 < position.count; i += 3) {
      const corners = [0, 1, 2].map((k) =>
        new THREE.Vector3()
          .fromBufferAttribute(position, i + k)
          .applyMatrix4(part.matrixWorld),
      );
      const [a, b, c] = corners;
      const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      const center = a.clone().add(b).add(c).divideScalar(3);
      const growth = normal.dot(UP) + patchiness(center) * 0.45 - 0.45;
      if (growth > 0) faces.push({ corners, normal, growth });
    }
  });
  const key = (p: THREE.Vector3) =>
    `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)},${Math.round(p.z * 1000)}`;
  // Lone faces or small clusters would read as painted triangles, so moss
  // grows only in patches large enough to look like they spread there.
  const byCorner = new Map<string, number[]>();
  faces.forEach(({ corners }, index) => {
    for (const corner of corners) {
      if (!byCorner.has(key(corner))) byCorner.set(key(corner), []);
      byCorner.get(key(corner))!.push(index);
    }
  });
  const patch = new Array<number>(faces.length).fill(-1);
  const patchSizes: number[] = [];
  faces.forEach((_, start) => {
    if (patch[start] >= 0) return;
    const id = patchSizes.push(0) - 1,
      queue = [start];
    patch[start] = id;
    while (queue.length) {
      const index = queue.pop()!;
      patchSizes[id]++;
      for (const corner of faces[index].corners)
        for (const next of byCorner.get(key(corner))!)
          if (patch[next] < 0) {
            patch[next] = id;
            queue.push(next);
          }
    }
  });
  const grown = faces.filter((_, index) => patchSizes[patch[index]] >= 6);
  if (grown.length === 0) return;
  // Neighboring faces lift their shared corners the same way, so the skin
  // stays closed instead of cracking along every edge.
  const lifts = new Map<string, THREE.Vector3>();
  for (const { corners, normal } of grown)
    for (const corner of corners) {
      const lift = lifts.get(key(corner)) ?? new THREE.Vector3();
      lifts.set(key(corner), lift.add(normal));
    }
  const skin: THREE.Vector3[] = [],
    colors: number[] = [],
    tufts: THREE.BufferGeometry[] = [];
  for (const { corners, normal, growth } of grown) {
    for (const corner of corners)
      skin.push(
        corner
          .clone()
          .addScaledVector(
            lifts.get(key(corner))!.clone().normalize(),
            THICKNESS,
          ),
      );
    const tone = mossTone(species, random);
    for (let k = 0; k < 3; k++) colors.push(tone.r, tone.g, tone.b);
    const [a, b, c] = corners;
    const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    let count = area * 400 * growth;
    while (random() < count--) {
      // A random point on the face, where a tuft pushes up through the skin.
      let u = random(),
        v = random();
      if (u + v > 1) [u, v] = [1 - u, 1 - v];
      const at = a
        .clone()
        .addScaledVector(b.clone().sub(a), u)
        .addScaledVector(c.clone().sub(a), v)
        .addScaledVector(normal, THICKNESS * 0.5);
      const tuft = growTuft(species, random);
      tuft.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(UP, normal),
      );
      tuft.translate(at.x, at.y, at.z);
      tufts.push(tuft);
    }
  }
  const cover = new THREE.BufferGeometry().setFromPoints(skin);
  cover.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  cover.computeVertexNormals();
  const merged = mergeGeometries([cover, ...tufts]);
  if (!merged) throw new Error("Could not merge moss geometry.");
  [cover, ...tufts].forEach((geometry) => geometry.dispose());
  const moss = new THREE.Mesh(merged, mossMaterial());
  moss.castShadow = moss.receiveShadow = true;
  model.add(moss);
}

/** One small tuft in the shape of its species, rising along +y. */
function growTuft(species: MossSpecies, random: () => number) {
  const size = 0.02 + random() * 0.025;
  // Sprigs and strands are drawn at full moss size, so shrink them to tufts.
  if (species === "fern")
    return sprigs(4, size, species, random).scale(0.7, 0.7, 0.7);
  if (species === "java") return strands(4, size, random).scale(0.6, 0.6, 0.6);
  const tuft = dome(
    size,
    size * (species === "cushion" ? 0.7 : 0.4),
    species,
    random,
    0.25,
    1,
  );
  tuft.deleteAttribute("uv");
  return tuft;
}
