import * as THREE from "three";
import { material, mesh } from "./geometry";
import { ringVolume, triangles, type Point } from "./faceted";

/** Narrow spindle, defined gill plane and a forked tail rather than a round body. */
export function fish() {
  const root = new THREE.Group();
  const gold = material("#cfa34d", 0.72);
  const fin = material("#b9733d", 0.8);
  const dark = material("#182a27", 0.55);
  const sections = [
    [-0.19, 0.013, 0.022],
    [-0.145, 0.04, 0.049],
    [-0.075, 0.048, 0.067],
    [0.045, 0.035, 0.052],
    [0.15, 0.009, 0.018],
  ];
  const rings = sections.map(([z, width, height]) =>
    Array.from({ length: 8 }, (_, side): Point => {
      const angle = (side * Math.PI) / 4;
      return [Math.cos(angle) * width, Math.sin(angle) * height, z];
    }),
  );
  mesh(ringVolume(rings), gold, root);

  const tail = new THREE.Group();
  tail.name = "tail";
  tail.position.z = 0.15;
  root.add(tail);
  mesh(
    triangles(
      [
        [0, 0, 0],
        [0, 0.072, 0.13],
        [0, 0.023, 0.111],
        [0, 0, 0.062],
        [0, -0.023, 0.111],
        [0, -0.072, 0.13],
      ],
      [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5],
    ),
    fin,
    tail,
  );
  mesh(
    triangles(
      [
        [0, 0.06, -0.09],
        [0, 0.1, -0.025],
        [0, 0.035, 0.1],
      ],
      [0, 1, 2],
    ),
    fin,
    root,
  );
  for (const side of [-1, 1]) {
    mesh(
      triangles(
        [
          [side * 0.038, -0.015, -0.075],
          [side * 0.083, -0.046, 0.018],
          [side * 0.023, -0.037, 0.055],
        ],
        [0, 1, 2],
      ),
      fin,
      root,
    );
    const eye = mesh(new THREE.IcosahedronGeometry(0.007, 0), dark, root, [
      side * 0.035,
      0.024,
      -0.145,
    ]);
    eye.scale.x = 0.45;
    // Short, dark gill seam on each side reads at close range without noisy scales.
    mesh(
      triangles(
        [
          [side * 0.045, 0.03, -0.105],
          [side * 0.048, -0.029, -0.09],
          [side * 0.046, -0.025, -0.083],
        ],
        [0, 1, 2],
      ),
      material("#8f693c"),
      root,
    );
  }
  return root;
}
