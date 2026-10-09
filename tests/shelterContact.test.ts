import { expect, it } from "vitest";
import { Box3, Raycaster, Vector3 } from "three";
import { buildAsset, disposeAsset } from "../src/assets";
import { prebuilts } from "../src/model/prebuilts";

it.each([7, 42, 173])(
  "rests the slab cave roof on both blocks on flat ground for seed %s",
  (seed) => {
    const prebuilt = prebuilts.find((p) => p.id === "slab-cave")!;
    const models = prebuilt.pieces.map((piece) => {
      const model = buildAsset(piece.kind, seed);
      model.position.set(piece.x, piece.height ?? 0, piece.z);
      model.rotation.y = piece.rotation ?? 0;
      model.scale.setScalar(piece.scale ?? 1);
      model.updateMatrixWorld(true);
      return model;
    });
    const roof = models[prebuilt.pieces.findIndex((p) => p.on !== undefined)];
    const ray = new Raycaster();
    for (const support of models.slice(0, 2)) {
      const bounds = new Box3().setFromObject(support);
      let gap = Infinity;
      for (let x = bounds.min.x; x <= bounds.max.x; x += 0.02) {
        for (let z = bounds.min.z; z <= bounds.max.z; z += 0.02) {
          ray.set(new Vector3(x, 1, z), new Vector3(0, -1, 0));
          const top = ray.intersectObject(support)[0];
          ray.set(new Vector3(x, -1, z), new Vector3(0, 1, 0));
          const bottom = ray.intersectObject(roof)[0];
          if (top && bottom) gap = Math.min(gap, bottom.point.y - top.point.y);
        }
      }
      expect(gap).toBeLessThanOrEqual(0);
    }
    models.forEach(disposeAsset);
  },
);
