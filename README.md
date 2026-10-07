# Paludarium

A browser terrarium studio: build a planted habitat, place frogs and fish, and watch it come alive. Live at https://turnerburchard.com/paludarium/, deployed from `main` on every push. Built with React, TypeScript, React Three Fiber, and Three.js. Plants and hardscape are procedural; frogs are based on a CC0 Quaternius model. The app makes no external network requests.

## Running locally

Requires Node.js 22+.

```sh
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # static site in dist/

# Browser checks at desktop and phone sizes
npx playwright install chromium
npm run test:e2e       # production smoke and mobile HTTP-origin checks
npm run test:e2e:touch # focused mobile gestures and viewport resizing
npm run test:e2e:life  # breeding, juveniles, mortality, saves and Undo
npm run test:e2e:full  # longer desktop, terrain, touch and sharing flows
```

Routine CI runs format, unit tests, typecheck/build, a production browser smoke, and mobile menu/placement checks on an actual HTTP origin. The extensive mobile gesture suite and four deeper browser flows run locally with `test:e2e:full` or through CI’s manual **full_browser_checks** option. The HTTP regression replaces the duplicate mocked UUID browser test. To check the Safari engine, install WebKit with `npx playwright install --with-deps webkit`, then run `TOUCH_BROWSER=webkit npm run test:e2e:touch`.

`dist/` is a self-contained static site with relative asset paths, so it can be served from any subdirectory.

## Controls

The app opens in **View**, with a full-screen habitat. Tap a creature to follow it up close, or choose one from the info button’s collapsed list. Foliage in front of the watched animal fades; its supporting leaf stays visible. Faded foliage waits for 2.5 seconds of clear sight before returning gradually, so hops and leaf edges don’t make it flash. Stopping restores the foliage and eases the camera back. Animal needs are available in the compact watch card.

Switch to **Build** to add and rearrange objects. Choose an object, then tap a spot in the tank to place it. One-finger drags do not place or move the preview during placement, moving or copying. Two-finger drags pan the camera in every mode; pinch to zoom. Choose **Done** or **Cancel** to orbit with one finger again. Switching modes preserves the camera, selection, and open settings; desktop tools gently move the framing without rebuilding the scene. While placing, moving or copying, tap **Left** or **Right** to turn 15°, or hold to spin. R turns 30° and Shift+R turns back. On phones a bottom dock opens Add, Habitat and Life as sheets. Selecting animals or plants never opens a size slider; only rocks and driftwood offer **Adjust size**. Sliders preview changes while dragging and create one undo step on release, including releases outside the control. Undo restores the controls and live scene along with the saved world.

Habitat settings lead with lighting and water choices. Open **Shape landscape** to sculpt, smooth, paint soil/sand/stone/moss (painted moss grows low cushions above the waterline), or carve pools and streams. **Fine-tune habitat** contains precise water, lighting, enclosure and soil sliders. Each brush stroke is one undoable edit; Escape cancels an unfinished stroke. Terrain is included in saved and exported worlds.

Drag with one finger or the mouse to orbit when not placing. Drag with two fingers to pan, including while placing; scroll or pinch to zoom. On desktop, WASD pans the camera (Shift to move faster); **Reset view** (home icon) restores the default view. Leaving a close-up returns to your previous view and resumes automatic circling when life is running; dragging or WASD interrupts that return immediately. Escape stops watching, and Space pauses life. View disables editing shortcuts. Keyboard shortcuts are ignored while typing in fields or dialogs. A first visit opens on the fully submerged **Aquarium**, with driftwood, river stones, underwater plants, tetra schools, angelfish, gouramis, a rainbow shark and corydoras. **New world** also offers four land habitats built from animals and plants that live together: a Costa Rican **Cloud forest** with poison frogs, orchids and convict cichlids; a Rocky Mountain **Alpine creek** with a canyon tree frog, a plateau fence lizard, a tiger salamander, spruce, columbine, cutthroat trout and sculpins; a Mojave **Desert spring** with cacti, agave, leopard and desert spiny lizards, a chuckwalla, a desert tortoise and pupfish in a small pool; and a Vietnamese **Limestone grotto** of mossy stone and caves for mossy frogs, with elephant ears, begonias and harlequin rasboras. Water lilies float on the surface. An empty tank is also available. Any animal, fish included, can be watched from the Life tab, the inspector, or by tapping it in View. The Aquarium water choice fills any tank to just below the rim; terrestrial plants and animals still need dry ground.

## Sharing and first visits

View keeps the habitat clear of headlines and prompts. Tap a creature to follow it; the small info button holds the introduction and an optional creature list. **Share this world** sends a compressed snapshot of your committed layout in a link: name, plants, creatures, terrain, and settings. It opens the native share sheet or copies the link; a selectable link appears if sharing or clipboard access is unavailable. Recipients explore in View without overwriting their own saved habitat. **Build a copy** asks before replacing it, offers a backup export, and can be undone. Later edits don’t change links already sent. No account or server storage is needed. Text-message previews use the project image; live activity and field notes restart on opening. JSON export/import remains available for backups and worlds too large to share as links.

The static HTML provides a canonical URL, description, Open Graph and Twitter card metadata before JavaScript runs. `public/share.jpg` is a 1200 × 630 screenshot of the real demo. Regenerate it with `npm run share-image` after changing the starter habitat. Preview services may cache the old card.

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

**Adding an asset:** add its kind to `assetKinds` in the schema, write a definition file under `src/assets/` (see `plants/fern.ts` for a small one), and register it in `src/assets/index.ts`. TypeScript flags any kind without a definition. To swap a model, change only that asset's `build` function. An asset gives animals somewhere to go through `perches` (a route from the ground to a resting spot, over stems or along the top of bark) and `dens` (a sheltered spot behind an entrance). `src/model/plantSurfaces.ts` and `woodSurfaces.ts` hold that shared geometry so rendering and navigation agree.

**Frog model:** `scripts/prepare-frog-model.mjs` bakes the original GLB (`docs/inspiration/preferred-frog-original.glb`) into `src/assets/animals/frog.json`: the reshaped mesh with its skin weights, the skeleton, and the Idle, Jump and Attack clips. `src/assets/animals/frogs.ts` defines each species: proportions, coloring, markings and behavior. `src/scene/frogRig.ts` animates it: the jump clip follows each hop's progress, the frog breathes and sleeps low, and between hops its feet stay planted on the surface and step as the body moves or turns.

An importable [Stacked lookout habitat](examples/stacked-lookout.json) demonstrates two mossy stones supporting an anthurium, with a tree frog that can climb to its leaves and return to the shoreline. Use Import in Build mode to open it.

## Current behavior and limits

- Saves live in browser storage, with JSON export/import for backups and moving between devices.
- Undo covers the last 60 edits, including replacing a world.
- Up to 120 objects. Dense plantings can be heavy on mobile GPUs.
- Plants and frogs need dry ground and fish need water depth when placed. Stone, wood and cattails accept land or water placement. Raising water doesn't move or flag existing objects, but can leave terrestrial animals without reachable ground. Fully submerged tanks show aquatic life and hardscape in the Add tray.
- Plants, stones and moss can sit on top of stone and wood, so rocks stack into ledges and caves. A stack moves, turns and resizes with what's under it, and settles to the ground when that is removed. Connected stone and wood surfaces let animals climb the stack and reach plants resting on top.
- Back glass stays clear. Older saved worlds and shared layouts with stone or cork backdrops still load; the removed backdrop is ignored.
- Frogs seek food, water, rest, and sleep. Tree frogs climb connected glass and plant stems, rest on monstera, anthurium, fern, bromeliad and climbing philodendron foliage, and leap between nearby leaves. Canyon tree frogs climb too and rest on rock. Dart frogs make quick, ballistic hops over ground and gentle stone surfaces; mossy frogs crawl and use low perches. Outings vary in distance and pause length, favor places the animal has not just visited, and include small turns while resting. Ground routes include safe diagonals; stone and wood routes follow the exposed mesh, including stacked ledges. Steep approaches require a climber. Frame interpolation smooths movement without slowing hops. Any frog can walk up a gently leaning branch or onto a log, while steeper bark needs a climber, and frogs hide in dens inside hollow logs and under rock shelters. Two animals don't settle on the same spot. Garden snails graze over glass and leaves at night and a painted wood turtle plods the forest floor; both browse rather than compete for insects. A gold dust day gecko shares the habitat: active by day, it dashes over ground, bark, glass and stems with an S-shaped swing through its body and tail, eats the same insects, and rests on glass, bark and leaves. Three Southwestern lizards share the gecko's model in their own colors: a sandy, spotted long-nosed leopard lizard, a dark, yellow-banded desert spiny lizard, and a striped plateau fence lizard. The leopard lizard sprints over open ground and stone; the spiny and fence lizards climb rock and wood to bask. A western tiger salamander and a grazing chuckwalla use the same model, and a desert tortoise shares the turtle's. Boreal chorus frogs are striped recolors of the frog. Frogs are animated with the source model's rig: a crouch before each hop, a landing, turns on the spot, and feet that stay on the surface while they crawl or climb. The gecko is a CC BY model rigged by `scripts/prepare-gecko-model.mjs` and animated by `src/scene/geckoRig.ts`, sharing the frogs' planted feet. Fish swim in open water, each species schooling only with its own kind at its own depth and pace (pond fish, cardinal and ember tetras, tiger barbs, whose bodies flex with a rigged swim, freshwater angelfish, pearl gouramis, convict cichlids, harlequin rasboras, cutthroat trout, Amargosa pupfish, and rainbow sharks, bronze corydoras and mottled sculpins that keep to the bottom), and steer around submerged stones, wood, stems and leaves with room for their bodies and tails. Small fish can use narrow gaps and hollow logs; bottom dwellers keep their fins clear of the substrate. Ordinary habitat edits preserve the school’s live positions. Now and then a fish leaves its school to wander alone for a few seconds. They don't eat or get hungry yet.
- Insects breed in colonies under plant, moss and leaf litter cover and inside dens, growing back toward a capacity set by that cover. A well-planted tank feeds its insect eaters without help. The Life tab lists every animal with what it is doing and a button to watch it, counts the fish by species, and **Follow someone** picks a creature to watch. There are no feed or mist chores. Turtles and snails graze independently, and fish don’t compete for insects.
- Each plant likes a soil (water's edge, damp, or well drained up the bank), measured by height above the waterline. A plant outside its band struggles and gives less cover; the inspector says why.
- All animals breed without tracking sexes: two healthy adults of the same species can produce a small juvenile when planting and tank space support another inhabitant. Juveniles grow into adults. Food for long-term survival is a simple shared planting budget, including moss, rather than a detailed diet or prey simulation. Suitable planting supports roughly one animal per plant or moss patch with the current forgiving tuning. Overcrowding and insufficient planting slowly lower condition; adding planting or reducing the population allows recovery. Animals also eventually die of old age.
- Life cycles use active real time: juveniles mature in about 15 minutes, healthy pairs can breed after about 30 minutes, and lifespans vary from three to five hours. Placed adults start at varied ages. These are game values rather than biological measurements. Brief shortages are harmless; a completely unsupported animal takes about two active hours to lose all condition.
- The simulation runs only while the tab is visible. The layout, offspring, age and condition are saved; activity, short-term needs and field notes restart on reload. Nothing advances while the app is closed. Automatic life changes do not create Undo steps, but restoring an earlier edited world can reverse births and deaths. Sharing and export include life-cycle state.
- Tiny moving springtails appear under cover when viewed up close, with a bounded visual sample. No plant growth, predation, eggs or tadpoles yet.

## Direction

The goal is an ecosystem sandbox with the satisfying placement and natural consequences of a city builder, without currencies or menu sprawl. Visual references are Costa Rican cloud forests and the US Mountain West, in a low-poly-realism style. Frogs are the priority inhabitants. Progression should come from ecological success, such as a stable breeding habitat or a thriving plant community.

More detail:

- [BACKLOG.md](BACKLOG.md): priorities and planned work
- [docs/ECOSYSTEM.md](docs/ECOSYSTEM.md): simulation design, tuning, and natural-history sources
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md): crowded-scene measurements and how to reproduce them
- [docs/PROJECT-BRIEF.md](docs/PROJECT-BRIEF.md): project brief
- [docs/inspiration/](docs/inspiration/): art direction references

## License

Copyright © 2026 Turner Burchard. All rights reserved. The source is public for reference but is not open source; see [LICENSE](LICENSE). Third-party components keep their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
