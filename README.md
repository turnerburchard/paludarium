# Paludarium

A personal browser terrarium studio: build a planted habitat, arrange its inhabitants, and watch it move. React, TypeScript, React Three Fiber, and Three.js. Plants and hardscape use procedural geometry; frogs derive from an included CC0 Quaternius model. Fonts use the system font stack; the deployed app makes no external resource requests.

## Work on it

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
npm test
npm run build

# Optional browser checks (desktop and phone layout)
npx playwright install chromium
npm run test:e2e
```

`dist/` is a portable static website with relative asset paths. Source belongs in `turnerburchard/paludarium`; publish the contents of `dist/` into `paludarium/` in `turnerburchard/turnerburchard.github.io` for https://turnerburchard.com/paludarium/. The adjacent `publish.sh` performs this one-time export and deployment using your own GitHub CLI login. It does not establish automatic synchronization with ChatGPT Sites.

## Rights

This project is publicly visible, proprietary software. See [LICENSE](LICENSE). No additional permission is granted to reuse, modify, redistribute, sell, or deploy covered material, except as required by law or granted by GitHub's terms. Third-party libraries and the CC0 Quaternius frog retain their own terms. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This export captures Sites source commit `28027d9be4655e7524ba5cc34872d0b3e3e684a8`. Unlicensed inspiration images are omitted from the public export; the original working project retains them.

## Architecture

- `src/model/`: versioned Zod save schema, asset definitions, deterministic terrain, and curated presets. No React or renderer dependency.
- `src/editor/`: bounded immutable undo/redo history, validated import/export, local storage, and editor commands.
- `src/scene/`: object geometry factories, terrain and water, lighting/camera, and animal poses. All assets dispose their GPU resources on removal. The catalog thumbnails use the same geometry with one temporary renderer.
- `src/ui/`: object library, environment controls, and reusable inputs.
- `src/App.tsx`: workspace composition and application-level actions.

`groundHeight` is the single source of truth for terrain rendering, object grounding, habitat validation, and movement. Each object stores a seed so geometry is stable through reloads and history. Scene objects are plain serializable data; avoid storing Three.js instances in the model.

To add a plant: add an asset kind to the schema, its definition to the catalog, and its geometry factory under `scene/assets/`, registered in `assetBuilders.ts`. New environment parameters must be reflected in schema validation and in save migrations if incompatible.

## Behavior and limits

- Saves are browser-local, with JSON export/import for backups and device transfer.
- Every change, including replacing a world, can be undone within the last 60 edits.
- Up to 120 objects. Large plant collections can be demanding on mobile GPUs.
- Plants and frogs require dry ground; fish require water depth. Raising water may invalidate existing placements, which are flagged for the user to fix.
- Frogs now use live needs-driven behavior with finite insect food, hydration, energy, sleep and connected ground/glass routes. Fish remain decorative. Activity pauses in hidden tabs and restarts on reload; only layout is persisted. There is no growth, predation, breeding, mortality, or offline simulation yet.
- Scenes are artistic habitats, not real animal husbandry recommendations.

## Long-term direction

The goal is an ecosystem sandbox with the satisfying placement and natural consequences of a city builder, without money systems or layers of menus. Costa Rican cloud forests and the US Mountain West are the visual touchstones; frogs are the priority inhabitants.

The first live behavior module is implemented in `src/simulation/`; see [ECOSYSTEM.md](docs/ECOSYSTEM.md) for contracts, tuning, natural-history sources and limits. Frogs seek finite insect food, soak at shorelines, explore connected surfaces, rest, and sleep according to species. Foliage perches and detailed rigged animation remain future work. Drop offline catch-up, timestamp-driven fast-forward and equilibrium shortcuts. A closed app does not advance the ecosystem.

Keep behavior outside the renderer: a simulation module owns animal needs and behavior states; rendering observes its positions and poses. Randomness belongs behind an injectable source so behaviors can be tested repeatably without making normal play scripted. Start with one well-observed frog species, food sources, moisture and shelter; add population dynamics only once individual behavior is convincing. The renderer poses existing meshes from engine state; it does not yet animate articulated walking.

The asset catalog now identifies four real frog species/color forms, with stable legacy IDs so existing saves keep working. Plant names are species-level where the current asset has an intended real-world identity; generic assets stay generic. Visual models are artistic approximations, not field-identification or husbandry tools.

Frogs now use the owner-selected Quaternius CC0 mesh, normalized and slightly slimmed by `scripts/prepare-frog-model.mjs`. The baked rest pose in `src/scene/assets/data/frog.json` keeps the synchronous factory and catalog thumbnails unchanged. `frogs.ts` owns species appearance. The original GLB, including its bones and four animation clips, is preserved in `docs/inspiration/preferred-frog-original.glb`; those clips are not played yet. All species currently share this base silhouette with differing proportions and coloration, so further species-specific anatomy is still needed. The prior rounded-volume generator remains available in `implicitSurface.ts` but no longer constructs frogs.

The entire game's target is low-poly realism: deliberate silhouettes, broad coherent planes and natural proportions, without inflated toy-like forms. See `docs/inspiration/README.md` and `docs/PROJECT-BRIEF.md` for owner references. Frog art work must remain separate from ecosystem behavior work.

Desktop WASD translates the camera and orbit target together, Shift moves faster, and Reset Camera restores the initial view. Keyboard navigation ignores text fields, dialogs, and system shortcuts and releases held keys when the page loses focus.

Future gamification should follow ecological successes—stable breeding habitat, a thriving plant community—not arbitrary currencies. Expand enclosure shapes, terrain sculpting, waterfalls, habitat scale, and species only as the editor and simulation remain understandable.

## Release planning

See [BACKLOG.md](BACKLOG.md) for priorities, acceptance criteria, parked ideas and deployment blockers. Light warmth and brightness are saved with each world; legacy saves receive neutral defaults. Glass panes sit outside the soil surface to avoid coplanar depth artifacts.
