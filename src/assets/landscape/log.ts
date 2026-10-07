import * as THREE from "three";
import { logDens, logPerches, logShape } from "../../model/woodSurfaces";
import { material, mesh } from "../geometry";
import { ringStrip, type Point } from "../faceted";
import type { AssetDefinition } from "../types";
import { banded, barkMaterials, limbRings } from "./bark";

export const log: AssetDefinition = {
  kind: "log",
  name: "Hollow log",
  category: "Landscape",
  description:
    "A fallen, hollow log. Frogs shelter inside and sun on top, and insects breed beneath it.",
  radius: 0.62,
  habitat: "either",
  hardscape: "wood",
  blocksMovement: true,
  shelter: true,
  perches: logPerches,
  dens: logDens,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const { outer, inner } = logShape(random);
  const centers = outer.points.map((p): Point => [p.x, p.y, p.z]);
  const outside = limbRings(centers, outer.radii, 10);
  const inside = limbRings(centers, inner, 10);
  const { cut } = barkMaterials();
  const shell = banded(ringStrip(outside));
  mossOnTop(shell, random);
  const bark = material("#ffffff", 0.94);
  bark.vertexColors = true;
  mesh(shell, bark, root);
  mesh(ringStrip(inside, true), material("#3a2b20", 1), root);
  // End grain closes the wall between bark and hollow at both ends.
  mesh(ringStrip([outside[0], inside[0]], true), cut, root);
  mesh(ringStrip([outside.at(-1)!, inside.at(-1)!]), cut, root);
  return root;
}

/** Bark tones, with moss creeping over the upward-facing faces in patches. */
function mossOnTop(geometry: THREE.BufferGeometry, random: () => number) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const color = geometry.getAttribute("color");
  const bark = new THREE.Color("#5e4a39");
  const moss = new THREE.Color("#5d7a33");
  const tone = new THREE.Color();
  const phase = random() * 10;
  for (let i = 0; i < normal.count; i += 3) {
    // Uneven, facet by facet: moss holds in some cracks and not others.
    const patchy =
      Math.sin(position.getX(i) * 7 + phase) * 0.35 +
      Math.sin(position.getX(i) * 23 + position.getZ(i) * 31 + phase) * 0.3 +
      0.45;
    const cover = Math.min(
      1,
      Math.max(0, normal.getY(i) - 0.45) * 2.5 * patchy,
    );
    for (let corner = 0; corner < 3; corner++) {
      tone
        .fromBufferAttribute(color, i + corner)
        .multiply(bark)
        .lerp(moss, cover);
      color.setXYZ(i + corner, tone.r, tone.g, tone.b);
    }
  }
}
