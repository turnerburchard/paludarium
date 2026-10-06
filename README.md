# Paludarium

A browser terrarium studio: build a planted habitat, place frogs and fish, and watch it come alive. Built with React, TypeScript, React Three Fiber, and Three.js. Plants and hardscape are procedural; frogs are based on a CC0 Quaternius model. The app makes no external network requests.

## Running locally

Requires Node.js 22+.

```sh
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # static site in dist/

# Browser checks at desktop and phone sizes
npx playwright install chromium
npm run test:e2e
```

`dist/` is a self-contained static site with relative asset paths, so it can be served from any subdirectory.

## Controls

Drag to orbit and scroll to zoom. Select a frog and choose **Watch up close** to follow it with the camera. On desktop, WASD pans the camera (Shift to move faster); **Reset Camera** restores the default view. Keyboard navigation is ignored while typing in fields or dialogs.

## Architecture

- `src/model/`: versioned Zod save schema, deterministic terrain, and presets. No React or rendering code.
- `src/assets/`: one definition per placeable thing: catalog info, traits (blocks movement, gives shelter, frog behavior), and the function that builds its 3D model.
- `src/editor/`: undo/redo history, validated import/export, local storage, and editor commands.
- `src/simulation/`: animal needs and behavior. Owns state that the renderer only observes.
- `src/scene/`: geometry factories, terrain and water, lighting, camera, and animal poses. Assets dispose their GPU resources on removal.
- `src/ui/`: object library, environment controls, and shared inputs.
- `src/App.tsx`: workspace composition and app-level actions.

Conventions:

- `groundHeight` is the single source of truth for terrain rendering, object placement, habitat validation, and movement.
- Scene objects are plain serializable data with a stored seed, so geometry is stable across reloads and undo. Don't put Three.js instances in the model.
- Randomness in the simulation goes through an injectable source so behavior is testable.
- Changes to environment parameters need matching schema validation, plus a save migration if the change is incompatible.

**Adding an asset:** add its kind to `assetKinds` in the schema, write a definition file under `src/assets/` (see `plants/fern.ts` for a small one), and register it in `src/assets/index.ts`. TypeScript flags any kind without a definition. To swap a model, change only that asset's `build` function.

**Frog model:** `scripts/prepare-frog-model.mjs` normalizes the original GLB (`docs/inspiration/preferred-frog-original.glb`) into the baked rest pose in `src/assets/animals/frog.json`. `src/assets/animals/frogs.ts` defines each species: proportions, coloring, markings and behavior. The GLB's rig and animation clips aren't used yet.

## Current behavior and limits

- Saves live in browser storage, with JSON export/import for backups and moving between devices.
- Undo covers the last 60 edits, including replacing a world.
- Up to 120 objects. Dense plantings can be heavy on mobile GPUs.
- Plants and frogs need dry ground and fish need water depth. Raising the water can invalidate existing placements, which get flagged.
- Frogs seek food, water, rest, and sleep, and move along connected ground and glass. Fish swim as a loose school in open water and turn back from the shore; they don't eat or get hungry yet.
- Insects breed in colonies under plant and moss cover, growing back toward a capacity set by that cover. A well-planted tank feeds its frogs without help; the Life panel shows how many frogs the insects can support.
- The simulation runs only while the tab is visible. Only the layout is saved, and nothing advances while the app is closed.
- No growth, predation, breeding, or mortality yet.

## Direction

The goal is an ecosystem sandbox with the satisfying placement and natural consequences of a city builder, without currencies or menu sprawl. Visual references are Costa Rican cloud forests and the US Mountain West, in a low-poly-realism style. Frogs are the priority inhabitants. Progression should come from ecological success, such as a stable breeding habitat or a thriving plant community.

More detail:

- [BACKLOG.md](BACKLOG.md): priorities and planned work
- [docs/ECOSYSTEM.md](docs/ECOSYSTEM.md): simulation design, tuning, and natural-history sources
- [docs/PROJECT-BRIEF.md](docs/PROJECT-BRIEF.md): project brief
- [docs/inspiration/](docs/inspiration/): art direction references

## License

Copyright © 2026 Turner Burchard. All rights reserved. The source is public for reference but is not open source; see [LICENSE](LICENSE). Third-party components keep their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
