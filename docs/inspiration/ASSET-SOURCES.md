# Downloadable frog candidates

Checked October 5, 2026. These are candidates, not imported or validated production assets.

Selected and imported after owner feedback: [Quaternius Frog 9Z2V8fpazF](https://poly.pizza/m/9Z2V8fpazF), CC0, FBX/GLTF, four animation clips. Original source is retained locally in this directory. The rest pose supplies the current visual factory; animations are not yet integrated. The earlier Quaternius candidate below was rejected visually by the owner.

| Source | Declared license and format | Notes |
| --- | --- | --- |
| [Quaternius frog on Poly Pizza](https://poly.pizza/m/37wofOCOzG) | CC0; FBX/GLTF; tagged animated | Promising route for a directly usable animated model. Inspect anatomy, available animation clips, scale and materials before integration. |
| [Methodical pixel frog on OpenGameArt](https://opengameart.org/content/frog-low-poly-animated-3d-model) | CC0; Blender; rigged and animated; 600 triangles | Likely too coarse/retro for the supplied visual references; useful comparison, requires conversion to GLB. |
| [Striderrotk frog on Sketchfab](https://sketchfab.com/3d-models/frog-lowpoly-animated-d1f627b4b83b415da40f66e764bd08f5) | Search listing says CC Attribution; rigged and animated; about 3,100 triangles | Direct page access returned 403 during this check. Verify the downloadable package and full attribution requirements before use. |

Use the asset factory boundary to integrate GLB models without changing ecosystem decisions. Preserve saved asset IDs and species metadata. Add animation clips as a visual interface for the behavior owner rather than implementing hunger, hydration or movement decisions here.

Every imported model needs a retained source, license, attribution if required, normalized scale/orientation, a grounded pose, and verified resource disposal. Avoid mixing assets with sharply different visual styles just because they are free.

# Other imported models

| Model | Source and license | Use |
| --- | --- | --- |
| Tiger barb (`models/fish-quaternius.glb`) | ["Fish" by Quaternius](https://poly.pizza/m/BEcU9rjiAq), CC0 (a clownfish) | Baked by `scripts/prepare-fish-model.mjs` with its skeleton and swim clip (minus the root track, which carries the turn and scale), recolored as a tiger barb. |
| Cattail (`models/cattail-poly-google.glb`) | ["Cattail" by Poly by Google](https://poly.pizza/m/9uT74BMpRrl), CC BY 3.0 | Baked by `scripts/prepare-static-models.mjs`; a shoreline plant. |
| Snail (`models/snail-poly-google.glb`) | ["Snail" by Poly by Google](https://poly.pizza/m/aZ_cT-AIu2y), CC BY 3.0 | Baked by `scripts/prepare-static-models.mjs`; shell and body are separate parts for `SnailRig`. |
| Gecko (`models/gecko-poly-google.glb`) | ["Salamander" by Poly by Google](https://poly.pizza/m/eqjMAgmr-pM), CC BY 3.0; its texture is named Tex_Gecko | Baked by `scripts/prepare-gecko-model.mjs` into the gold dust day gecko: turned to face -Z, scaled, fitted with the gecko skeleton and skin weights, and recolored from its four-color palette. Credited in THIRD_PARTY_NOTICES.md. |

Owner-preferred look (October 6, 2026): Quaternius-style chunky low poly, as in the Animated Animal Pack and Animated Dinosaur Bundle on Poly Pizza. Candidates the owner suggested for later: turtle, hummingbird and parrot (see issue #27), black caiman, seahorse (Poly by Google, CC BY 3.0) and fish and spider (Quaternius, CC0).
