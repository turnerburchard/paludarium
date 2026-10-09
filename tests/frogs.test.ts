import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildAsset } from "../src/assets";
import { frogClips } from "../src/assets/animals/frogs";
import frogModel from "../src/assets/animals/frog.json";
import type { AssetKind } from "../src/model/schema";

/** The shared body's own skin vertices, before any added warts or horns. */
const BODY_VERTICES = frogModel.parts.find((p) => p.material === "Green")!.index
  .length;

function skin(model: THREE.Object3D) {
  let mesh: THREE.SkinnedMesh | undefined;
  model.traverse((object) => {
    if (
      object instanceof THREE.SkinnedMesh &&
      object.geometry.getAttribute("position").count >= BODY_VERTICES
    )
      mesh = object;
  });
  return mesh!;
}

function posed(kind: AssetKind, clip: keyof typeof frogClips) {
  const model = buildAsset(kind, 5);
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(frogClips[clip]).play();
  mixer.update(frogClips[clip].duration * 0.4);
  model.updateMatrixWorld(true);
  return model;
}

function vertices(mesh: THREE.SkinnedMesh, from: number, to: number) {
  return Array.from({ length: to - from }, (_, i) =>
    mesh.getVertexPosition(from + i, new THREE.Vector3()),
  );
}

/** Width of the belly, which only the trunk carries, relative to the frog's size. */
function bellyWidth(kind: AssetKind) {
  const model = buildAsset(kind, 5);
  let width = 0;
  model.traverse((object) => {
    if (
      object instanceof THREE.SkinnedMesh &&
      object.geometry.getAttribute("position").count < BODY_VERTICES
    ) {
      object.geometry.computeBoundingBox();
      width = Math.max(width, object.geometry.boundingBox!.max.x);
    }
  });
  return width;
}

describe("frog body shapes", () => {
  it("makes squat frogs broader than climbers", () => {
    expect(bellyWidth("western-toad")).toBeGreaterThan(
      bellyWidth("tree-frog") * 1.3,
    );
    expect(bellyWidth("horned-frog")).toBeGreaterThan(
      bellyWidth("western-toad"),
    );
  });

  it("keeps warts on the skin while the frog leaps", () => {
    const gaps = (["idle", "jump"] as const).map((clip) => {
      const mesh = skin(posed("mossy-frog", clip));
      const count = mesh.geometry.getAttribute("position").count;
      const body = vertices(mesh, 0, BODY_VERTICES);
      const faces = Array.from(
        { length: BODY_VERTICES / 3 },
        (_, i) =>
          new THREE.Triangle(body[i * 3], body[i * 3 + 1], body[i * 3 + 2]),
      );
      const closest = new THREE.Vector3();
      return vertices(mesh, BODY_VERTICES, count).map((wart) =>
        Math.min(
          ...faces.map((face) =>
            face.closestPointToPoint(wart, closest).distanceTo(wart),
          ),
        ),
      );
    });
    expect(gaps[0].length).toBeGreaterThan(BODY_VERTICES * 0.2);
    // The skin bends a little under each wart in a leap, but a wart left
    // behind by the body would drift several times further.
    gaps[0].forEach((gap, i) => expect(gaps[1][i]).toBeLessThan(gap + 0.03));
  });

  it("gives smooth frogs no warts, and carries horns with the head", () => {
    expect(
      skin(buildAsset("tree-frog", 5)).geometry.getAttribute("position").count,
    ).toBe(BODY_VERTICES);
    const offsets = (["idle", "attack"] as const).map((clip) => {
      const model = posed("horned-frog", clip);
      const mesh = skin(model);
      const head = model
        .getObjectByName("Head")!
        .getWorldPosition(new THREE.Vector3());
      const count = mesh.geometry.getAttribute("position").count;
      return vertices(mesh, BODY_VERTICES, count).map((point) =>
        mesh.localToWorld(point).distanceTo(head),
      );
    });
    expect(offsets[0].length).toBeGreaterThan(0);
    offsets[0].forEach((distance, i) =>
      expect(offsets[1][i]).toBeCloseTo(distance, 2),
    );
  });
});
