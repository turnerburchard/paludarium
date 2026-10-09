import { it } from "vitest";
import { makePreset } from "../../src/model/presets";
import { assets } from "../../src/assets";
it("near", () => {
  const w = makePreset("aquarium");
  for (const o of w.objects) {
    const d = Math.hypot(o.x + 2.34, o.z + 1.62);
    if (d < 1) console.log(o.kind, d.toFixed(2), o.x.toFixed(2), o.z.toFixed(2), o.scale, assets[o.kind].hardscape ? "hard" : "soft");
  }
});
