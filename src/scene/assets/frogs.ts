import * as THREE from "three";
import type { FrogKind } from "../../model/species";
import frogParts from "./data/frog.json";

interface Appearance {
  back: string;
  belly: string;
  iris: string;
  feet: string;
  height: number;
  size: number;
  roughness: number;
}
const appearances: Record<FrogKind, Appearance> = {
  "tree-frog": {
    back: "#57902f",
    belly: "#d2d0a0",
    iris: "#b73519",
    feet: "#dc852b",
    height: 1.08,
    size: 0.75,
    roughness: 0.68,
  },
  "dart-frog": {
    back: "#d34a25",
    belly: "#ae5234",
    iris: "#191b18",
    feet: "#245b78",
    height: 0.88,
    size: 0.6,
    roughness: 0.7,
  },
  "blue-dart-frog": {
    back: "#1958b1",
    belly: "#3171bb",
    iris: "#10171e",
    feet: "#143c83",
    height: 0.88,
    size: 0.75,
    roughness: 0.65,
  },
  "mossy-frog": {
    back: "#53683b",
    belly: "#7b7a4e",
    iris: "#88794b",
    feet: "#424b30",
    height: 0.9,
    size: 0.84,
    roughness: 0.86,
  },
};

/** Artist-authored silhouette and topology; colors vary without changing saved IDs.
 * Source: Quaternius, poly.pizza/m/9Z2V8fpazF, CC0.
 * Rest-pose preparation and the original rig live outside the renderer.
 */
export function frog(kind: FrogKind, random: () => number): THREE.Group {
  const root = new THREE.Group();
  const appearance = appearances[kind];
  const back = new THREE.Color(appearance.back);
  const belly = new THREE.Color(appearance.belly);
  const feet = new THREE.Color(appearance.feet);
  const dark = new THREE.Color("#112329");
  const mossLight = new THREE.Color("#92904d");
  const mossDark = new THREE.Color("#202d21");
  const dart = kind === "dart-frog" || kind === "blue-dart-frog";
  const spots = Array.from(
    { length: kind === "blue-dart-frog" ? 28 : 14 },
    () => ({
      x: (random() - 0.5) * 0.28,
      z: (random() - 0.5) * 0.43,
      radius: 0.009 + random() * 0.019,
      stretch: 0.65 + random() * 0.7,
    }),
  );

  for (const part of frogParts) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    geometry.computeVertexNormals();
    const skin = part.material === "Green";
    const baseColor =
      part.material === "Yellow"
        ? belly
        : part.material === "Red"
          ? new THREE.Color(appearance.iris)
          : part.material === "Black"
            ? dark
            : back;
    const material = new THREE.MeshStandardMaterial({
      color: skin ? "#ffffff" : baseColor,
      vertexColors: skin,
      flatShading: true,
      metalness: 0,
      roughness: skin
        ? appearance.roughness
        : part.material === "Red" || part.material === "Black"
          ? 0.28
          : 0.75,
    });
    if (skin) {
      const positions = geometry.getAttribute("position");
      const colors = new Float32Array(positions.count * 3);
      const color = new THREE.Color();
      // Paint whole faces so markings reinforce the broad planes, not a tiled grid.
      for (let i = 0; i < positions.count; i += 3) {
        const x =
          (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) /
          3;
        const y =
          (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) /
          3;
        const z =
          (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) /
          3;
        color.copy(back);
        if (Math.abs(x) > 0.12 && y < 0.11) color.copy(feet);
        else if (
          dart &&
          y > 0.1 &&
          spots.some(
            (spot) =>
              Math.hypot((x - spot.x) / spot.stretch, (z - spot.z) * 0.8) <
              spot.radius,
          )
        )
          color.copy(dark);
        else if (kind === "mossy-frog") {
          const mottling =
            Math.sin(x * 40 + Math.sin(z * 29) * 2) * Math.cos(z * 41 - y * 43);
          color.lerp(
            mottling > 0 ? mossLight : mossDark,
            Math.abs(mottling) * 0.65,
          );
        }
        for (let corner = 0; corner < 3; corner++)
          colors.set([color.r, color.g, color.b], (i + corner) * 3);
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    geometry.scale(
      appearance.size,
      appearance.height * appearance.size,
      appearance.size,
    );
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}
