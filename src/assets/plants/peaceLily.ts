import * as THREE from "three";
import { buildBaked } from "../baked";
import { curvedStem, material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";
import peaceLilyModel from "./peaceLily.json";

export const peaceLily: AssetDefinition = {
  kind: "peace-lily",
  name: "Peace lily",
  scientificName: "Spathiphyllum wallisii",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description:
    "Glossy dark leaves in a clump, with white hooded flowers on tall stalks.",
  radius: 0.4,
  size: 1.1,
  scaleRange: [0.7, 1.3],
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

/** Model: "Flower Pot" by Zsky, CC-BY 3.0, without its pot. The flowers are
 * added here. */
function build(random: () => number) {
  const root = buildBaked(peaceLilyModel, () => ({ color: "#24461b" }));
  const stalk = material("#4b6e33");
  const spathe = material("#ffffff", 0.45);
  spathe.vertexColors = true;
  const white = new THREE.Color("#f2f1e6"),
    green = new THREE.Color("#c9dcae");
  const spadix = material("#e9dd9e", 0.7);
  const count = 2 + Math.floor(random() * 2);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.3 + random() * 0.8;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const top = out
      .clone()
      .multiplyScalar(0.1 + random() * 0.08)
      .setY(0.82 + random() * 0.18);
    curvedStem(
      root,
      [
        new THREE.Vector3(),
        out
          .clone()
          .multiplyScalar(0.03)
          .setY(top.y * 0.6),
        top,
      ],
      0.009,
      stalk,
    );
    // The hood stands nearly upright behind its spike, tipping slightly out,
    // greenish at the base like a real spathe.
    const length = 0.2 + random() * 0.05;
    const hood = mesh(
      ovalLeaf({
        length,
        width: length * 0.55,
        droop: -0.12,
        cup: 0.45,
        color: (along) => (along < 0.2 ? green : white),
      }),
      spathe,
      root,
    );
    const up = out.clone().multiplyScalar(0.25).setY(1).normalize();
    placeLeaf(hood, top, up, out);
    // The spike leans with the hood so its tip stays in front of it.
    const face = out.clone().addScaledVector(up, -out.dot(up)).normalize();
    const spike = mesh(
      new THREE.CylinderGeometry(0.011, 0.014, length * 0.4, 6),
      spadix,
      root,
      top
        .clone()
        .addScaledVector(up, length * 0.25)
        .addScaledVector(face, 0.035),
    );
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  }
  return root;
}
