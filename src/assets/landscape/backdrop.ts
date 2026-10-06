import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Backdrop } from "../../model/schema";
import { randomFromSeed } from "../../model/random";
import { material } from "../geometry";
import { growMoss } from "./mossCover";

/** A wall that covers the back glass: dry-laid stone or slabs of cork bark,
 * standing in a low relief so climbers still read as being on the wall. It
 * faces +z with its back at z = 0. */
export function buildBackdrop(
  width: number,
  height: number,
  { material: kind, moss }: Backdrop,
) {
  const random = randomFromSeed(kind === "stone" ? 11 : 23);
  const parts =
    kind === "stone"
      ? stones(width, height, random)
      : slabs(width, height, random);
  const backing = new THREE.PlaneGeometry(width, height)
    .translate(0, height / 2, 0.005)
    .toNonIndexed();
  paint(backing, kind === "stone" ? "#2b2924" : "#3a2819", 0, random);
  backing.deleteAttribute("uv");
  const merged = mergeGeometries([backing, ...parts]);
  if (!merged) throw new Error("Could not merge backdrop geometry.");
  [backing, ...parts].forEach((geometry) => geometry.dispose());
  merged.computeVertexNormals();
  const skin = material("#ffffff", 0.95);
  skin.vertexColors = true;
  const root = new THREE.Group();
  const wall = new THREE.Mesh(merged, skin);
  wall.receiveShadow = true;
  root.add(wall);
  if (moss)
    growMoss(root, moss, random, {
      facing: new THREE.Vector3(0, 0.35, 1).normalize(),
      threshold: 0.95,
      spread: 3,
    });
  return root;
}

/** Rows of flattened, uneven stones, each row offset like a dry-laid wall. */
function stones(width: number, height: number, random: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  const top = height - 0.1;
  for (let y = 0.08, row = 0; y < top - 0.08; row++) {
    const rowHeight = Math.min(0.16 + random() * 0.12, (top - y) / 0.65);
    // Stones stop short of the side glass, leaving room for their moss.
    const edge = width / 2 - 0.1;
    for (let x = -edge + (row % 2) * 0.12; x < edge - 0.08; ) {
      const stoneWidth = Math.min(0.2 + random() * 0.3, edge - x);
      const stone = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
      roughen(stone, random() * 10, 0.16);
      // Slightly narrower than its slot, since roughening bulges it.
      stone.scale(
        stoneWidth * 0.53,
        rowHeight * (0.5 + random() * 0.15),
        0.03 + random() * 0.025,
      );
      stone.translate(x + stoneWidth / 2, y + (random() - 0.5) * 0.04, 0.035);
      paint(stone, random() < 0.3 ? "#6d665c" : "#81786b", 0.12, random);
      stone.deleteAttribute("uv");
      parts.push(stone);
      x += stoneWidth;
    }
    y += rowHeight;
  }
  return parts;
}

/** Overlapping slabs of cork bark, knobbly and deeply creased. */
function slabs(width: number, height: number, random: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  const top = height - 0.1;
  for (let y = 0; y < top - 0.1; ) {
    const slabHeight = Math.min(0.7 + random() * 0.6, top - y);
    const edge = width / 2 - 0.1;
    for (let x = -edge; x < edge - 0.1; ) {
      const slabWidth = Math.min(0.4 + random() * 0.45, edge - x);
      const slab = new THREE.SphereGeometry(
        1,
        9,
        7,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      )
        .rotateX(Math.PI / 2)
        .toNonIndexed();
      const phase = random() * 10;
      const position = slab.getAttribute("position");
      for (let i = 0; i < position.count; i++) {
        const px = position.getX(i),
          py = position.getY(i),
          pz = position.getZ(i);
        // Creases run mostly up the bark, broken by knobs.
        const crease =
          1 +
          0.3 * Math.sin(px * 11 + phase) * Math.cos(py * 3 + phase) +
          0.15 * Math.sin(py * 9 - phase);
        position.setXYZ(i, px, py, pz * crease);
      }
      slab.scale(slabWidth * 0.5, slabHeight * 0.5, 0.05 + random() * 0.04);
      slab.translate(
        x + slabWidth / 2,
        y + slabHeight / 2 - random() * 0.05,
        0.01,
      );
      paint(slab, random() < 0.4 ? "#5e4634" : "#71563f", 0.2, random);
      slab.deleteAttribute("uv");
      parts.push(slab);
      x += slabWidth * 0.85;
    }
    y += slabHeight * 0.8;
  }
  return parts;
}

function roughen(
  geometry: THREE.BufferGeometry,
  phase: number,
  amount: number,
) {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i);
    const lump = 1 + amount * Math.sin(x * 5 + phase) * Math.cos(y * 4 - phase);
    position.setXYZ(i, x * lump, y * lump, Math.max(-0.2, z) * lump);
  }
}

/** Colors each face a little lighter or darker than the base color. */
function paint(
  geometry: THREE.BufferGeometry,
  color: string,
  spread: number,
  random: () => number,
) {
  const base = new THREE.Color(color);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 3) {
    const tone = base.clone().offsetHSL(0, 0, (random() - 0.5) * spread);
    for (let k = 0; k < 3; k++)
      colors.set([tone.r, tone.g, tone.b], (i + k) * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}
