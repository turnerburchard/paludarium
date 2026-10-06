import * as THREE from "three";
import { curvedStem, material, mesh } from "../geometry";
import { heart, orient, sagAt } from "../heart";
import { anthuriumLeaves } from "../../model/plantSurfaces";
import type { AssetDefinition } from "../types";

export const anthurium: AssetDefinition = {
  kind: "anthurium",
  name: "Anthurium",
  scientificName: "Anthurium andraeanum",
  category: "Plants",
  description:
    "Broad heart-shaped leaves held out level, with glossy red flowers.",
  radius: 0.42,
  habitat: "land",
  shelter: true,
  soil: "damp",
  perches: anthuriumLeaves,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const stalk = material("#4d7438");
  const greens = ["#2c6537", "#367640", "#285b33"].map((color) =>
    material(color, 0.45),
  );
  const vein = material("#6f9a52", 0.5);
  for (const [i, leaf] of anthuriumLeaves(random).entries()) {
    curvedStem(
      root,
      leaf.stem.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
      0.011,
      stalk,
    );
    const blade = heart(leaf.length, leaf.width, leaf.droop, greens[i % 3]);
    orient(blade, leaf.base, leaf.direction, leaf.normal);
    root.add(blade);
    // A pale midrib picks out the fold the frogs sit in.
    curvedStem(
      blade,
      [0, 0.25, 0.5, 0.75, 0.95].map(
        (t) =>
          new THREE.Vector3(
            0,
            sagAt(t, leaf.droop, leaf.length) + 0.003,
            t * leaf.length,
          ),
      ),
      0.0045,
      vein,
    );
  }
  const spathe = material("#c3302b", 0.28);
  const spadix = material("#e6cf86", 0.6);
  for (let i = 0; i < 3; i++) {
    const angle = i * 2.1 + random() * 0.6;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const top = out
      .clone()
      .multiplyScalar(0.12 + random() * 0.08)
      .setY(0.78 + random() * 0.2);
    curvedStem(
      root,
      [
        new THREE.Vector3(),
        out
          .clone()
          .multiplyScalar(0.04)
          .setY(top.y * 0.6),
        top,
      ],
      0.006,
      stalk,
    );
    // The flower tilts outward and up, with its spike rising from the notch.
    const facing = out.clone().setY(0.45).normalize();
    const up = new THREE.Vector3(0, 1, 0)
      .addScaledVector(facing, -facing.y)
      .normalize();
    const flower = heart(0.2, 0.17, 0.08, spathe);
    orient(flower, top, facing, up);
    root.add(flower);
    const spike = mesh(
      new THREE.ConeGeometry(0.01, 0.075, 5),
      spadix,
      root,
      top.clone().addScaledVector(up, 0.035).addScaledVector(facing, 0.01),
    );
    spike.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      up.clone().addScaledVector(facing, 0.3).normalize(),
    );
  }
  return root;
}
