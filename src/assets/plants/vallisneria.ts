import * as THREE from "three";
import { material, mesh } from "../geometry";
import type { AssetDefinition } from "../types";

export const vallisneria: AssetDefinition = {
  kind: "vallisneria",
  name: "Eelgrass",
  scientificName: "Vallisneria spiralis",
  category: "Plants",
  description:
    "Tall ribbon leaves that rise from the pool floor and bend over near the surface.",
  radius: 0.26,
  habitat: "water",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.6);
  skin.vertexColors = true;
  for (let i = 0; i < 16; i++) {
    const angle = random() * Math.PI * 2;
    mesh(
      ribbon(
        new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(
          random() * 0.12,
        ),
        random() * Math.PI * 2,
        0.9 + random() * 0.8,
        random,
      ),
      skin,
      root,
    );
  }
  return root;
}

/** A thin strap that rises nearly straight, leaning more the higher it gets,
 * with a slow twist so the faces catch the light differently. */
function ribbon(
  base: THREE.Vector3,
  heading: number,
  length: number,
  random: () => number,
) {
  const segments = 10,
    width = 0.035;
  const lean = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading));
  const bend = 0.25 + random() * 0.35,
    twist = (random() - 0.5) * 2;
  const dark = new THREE.Color("#3f7a33"),
    light = new THREE.Color("#8fbf5a");
  const positions: number[] = [],
    colors: number[] = [];
  const edge = (t: number) => {
    const center = base
      .clone()
      .addScaledVector(lean, bend * length * t * t)
      .setY(length * t * (1 - 0.25 * t * t * bend));
    const turn = heading + Math.PI / 2 + twist * t;
    const across = new THREE.Vector3(Math.cos(turn), 0, Math.sin(turn))
      // Tapers to a rounded tip.
      .multiplyScalar((width / 2) * Math.min(1, (1 - t) * 6));
    return [center.clone().add(across), center.clone().sub(across)];
  };
  for (let s = 0; s < segments; s++) {
    const [a, b] = edge(s / segments),
      [c, d] = edge((s + 1) / segments);
    const tone = dark.clone().lerp(light, (s + 0.5) / segments);
    for (const corner of [a, b, c, b, d, c]) {
      positions.push(corner.x, corner.y, corner.z);
      colors.push(tone.r, tone.g, tone.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
