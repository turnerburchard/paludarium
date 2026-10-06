# Frog visual references

Owner-supplied references, October 5, 2026. These images are reference material only, outside the public asset directory. Their licenses have not been established; do not ship them as textures, models, or catalog images.

- Green frog, 3D (reference image omitted from this public export): broad faceted surfaces, lifted head, clear folded thighs, dark eyes and spread toes.
- Green frog, front and side (reference image omitted from this public export): face and crouched silhouette. Watermarked stock illustration.
- Orange and blue dart frog (reference image omitted from this public export): low terrestrial posture, vivid warm back, irregular dark patches and blue limbs.

The first flat-shaded rounded-volume approach was rejected as still bulbous. The visual factory now uses the owner's preferred [Quaternius frog](https://poly.pizza/m/9Z2V8fpazF), declared CC0 on Poly Pizza, rather than the previously suggested model. The downloaded original GLB and preview are retained here. A preparation script bakes its rest pose, normalizes orientation/scale, and modestly slims the torso; species colors remain deterministic. The source rig is retained for future animation integration. Species IDs and saves are unchanged.

Whole-game references: mountain river diorama (reference image omitted from this public export) and river landscape (reference image omitted from this public export), supplied as image(8).png and image(9).png. Broad planes, angular silhouettes, coherent palette and soft shadows establish the desired low-poly aesthetic throughout the game. Avoid bulbous frogs; do not interpret the reference scenes as requests for buildings or campsites.

Further owner feedback: the imported frog was too large, mean-looking and skinny; the rocks are the strongest visual benchmark. The current mesh is simplified offline from 4,920 to 2,314 triangles, with thicker limbs, wider pupils and smaller species-dependent scale. The original file remains unchanged, so future rig work can start from it rather than the baked and simplified mesh.

The next asset pass removes the fish's ellipsoid body and cone tail in favor of a narrow spindle, distinct fins and forked tail. Moss becomes a shallow connected patch with small fronds. Driftwood uses tapered, irregular seven-sided sections, angular forks and inset end grain. Plants use broad leaf planes, lower-sided stems, pointed strawberry geometry and thin flower petals. `src/assets/faceted.ts` provides the small explicit-triangle/ring-volume helpers. Rocks retain their existing model and palette. Saved IDs and ecosystem rules remain unchanged.

See [the project brief](../PROJECT-BRIEF.md) for the full idea backlog and durable attachment identities.

The public export omits reference PNG/JPEG images whose redistribution rights have not been established. The CC0 original frog GLB remains included.
