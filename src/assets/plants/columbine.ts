import * as THREE from "three";
import { branch, material, mesh } from "../geometry";
import { triangles, type Point } from "../faceted";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const columbine: AssetDefinition = {
  kind: "columbine",
  name: "Colorado blue columbine",
  scientificName: "Aquilegia coerulea",
  group: "Leafy plants",
  biomes: ["Temperate"],
  description:
    "A mound of lacy leaves under nodding blue and white flowers with long spurs. A wildflower of mountain meadows and aspen groves.",
  radius: 0.28,
  habitat: "land",
  soil: "drained",
  build,
};

const UP = new THREE.Vector3(0, 1, 0);

function build(random: () => number) {
  const root = new THREE.Group();
  const leaves = material("#ffffff", 0.7);
  leaves.vertexColors = true;
  const green = new THREE.Color("#6b8f5a"),
    pale = new THREE.Color("#8eaa77");
  // Leaflets in threes on short stalks, making a soft mound.
  for (let i = 0; i < 12; i++) {
    const angle = i * 2.399 + random() * 0.3;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const stalk = out
      .clone()
      .multiplyScalar(0.08 + random() * 0.05)
      .setY(0.07 + random() * 0.05);
    branch(root, new THREE.Vector3(), stalk, 0.005, material("#5d7a4b"));
    for (const turn of [-0.7, 0, 0.7]) {
      const direction = out
        .clone()
        .applyAxisAngle(UP, turn)
        .setY(0.35)
        .normalize();
      const leaf = mesh(
        ovalLeaf({
          length: 0.1,
          width: 0.085,
          droop: 0.2,
          cup: 0.1,
          wave: 0.12,
          color: (along) => (along < 0.4 ? pale : green),
        }),
        leaves,
        root,
      );
      placeLeaf(leaf, stalk, direction, UP);
    }
  }
  const blue = material("#6f8fd6", 0.6),
    white = material("#f4f1e4", 0.6),
    yellow = material("#e9cf55");
  const count = 3 + Math.floor(random() * 3);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.2 + random();
    const top = new THREE.Vector3(
      Math.cos(angle) * 0.12,
      0.32 + random() * 0.16,
      Math.sin(angle) * 0.12,
    );
    branch(
      root,
      new THREE.Vector3(0, 0.05, 0),
      top,
      0.004,
      material("#5d6f4a"),
    );
    flower(root, top, blue, white, yellow);
  }
  return root;
}

/** Five pointed blue sepals around a cup of white petals, with spurs that
 * sweep back and up behind. The flower nods slightly outward. */
function flower(
  parent: THREE.Object3D,
  at: THREE.Vector3,
  blue: THREE.Material,
  white: THREE.Material,
  yellow: THREE.Material,
) {
  const head = new THREE.Group();
  head.position.copy(at);
  head.rotation.set(0.5, Math.atan2(at.x, at.z), 0);
  parent.add(head);
  for (let p = 0; p < 5; p++) {
    const a = (p * Math.PI * 2) / 5;
    const out = (r: number, y: number): Point => [
      Math.cos(a) * r,
      y,
      Math.sin(a) * r,
    ];
    const side = (r: number, y: number, s: number): Point => [
      Math.cos(a + s) * r,
      y,
      Math.sin(a + s) * r,
    ];
    // Sepal.
    mesh(
      triangles(
        [
          [0, 0, 0],
          side(0.03, 0.005, 0.4),
          out(0.065, -0.01),
          side(0.03, 0.005, -0.4),
        ],
        [0, 1, 2, 0, 2, 3],
      ),
      blue,
      head,
    );
    // Petal cup, offset between the sepals.
    const b = a + Math.PI / 5;
    mesh(
      triangles(
        [
          [0, 0.002, 0],
          [Math.cos(b - 0.35) * 0.022, 0.025, Math.sin(b - 0.35) * 0.022],
          [Math.cos(b + 0.35) * 0.022, 0.025, Math.sin(b + 0.35) * 0.022],
        ],
        [0, 1, 2],
      ),
      white,
      head,
    );
    // Spur.
    mesh(
      triangles(
        [
          [Math.cos(b - 0.3) * 0.012, 0, Math.sin(b - 0.3) * 0.012],
          [Math.cos(b) * 0.03, -0.055, Math.sin(b) * 0.03],
          [Math.cos(b + 0.3) * 0.012, 0, Math.sin(b + 0.3) * 0.012],
        ],
        [0, 1, 2],
      ),
      blue,
      head,
    );
  }
  mesh(new THREE.IcosahedronGeometry(0.008, 0), yellow, head, [0, 0.02, 0]);
}
