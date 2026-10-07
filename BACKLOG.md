# Paludarium work tracker

Keep completed work separate from proposed work; an idea is not automatically part of the next release.

## Current release

- [x] Remove filler menu and status text; use direct dialog headings and instructions.

- [x] Category-only Add menu, visible-card thumbnail generation with caching and cancellation, and a fixed-height mobile sheet with consistent tab widths and a right-aligned close control.

- [x] Species catalog: red-eyed tree frog, strawberry poison frog, blue poison dart frog, Vietnamese mossy frog; botanical names for identifiable plants.
- [x] Continuous frog anatomy with folded legs, smaller eyes, toe pads and species markings.
- [x] Desktop WASD camera movement, Shift for faster movement, typing/modal guards.
- [x] Dark studio background, overhead illumination, saved warmth and brightness controls.
- [x] Clear back glass across all habitats; removed stone/cork backdrops and their settings. Older saves and shared layouts still load.
- [x] Separate glass from soil faces; match sidewall and surface subdivisions.
- [x] More stone: sandstone boulders and ledges, granite boulders, slate stacks, limestone outcrops and river pebbles, placed in the desert, creek and grotto presets. Hardscape now names its material, so animals walk any stone as stone.
- [x] Realistic biomes: Cloud forest (Costa Rica), Alpine creek (Rocky Mountains), Desert spring (Mojave) and Limestone grotto (Vietnam, built around the mossy frog), each with species that live together. New chorus frog, tiger salamander, chuckwalla, desert tortoise, cutthroat trout, sculpin, convict cichlid, harlequin rasbora and pupfish; new spruce, columbine, kinnikinnick, hairgrass, cacti, agave, bunchgrass, begonia, elephant ear, water trumpet, orchid, tree philodendron and floating water lilies; an arid soil for desert plants.
- [x] Fully submerged Aquarium preset with driftwood, river stones, Java moss, cardinal and ember tetra schools; deep water fills below the rim and species swim at different depths.
- [x] Fast production-build browser smoke on routine pushes; longer gesture regression suite remains available on demand.
- [x] Published at turnerburchard.com/paludarium/ (GitHub Pages from this repo, deployed by CI on every push to `main`).
- [x] Clean phone layout: full-screen scene, bottom dock, panels as a sheet; first visit opens on the Aquarium.
- [x] Separate View/Build modes: viewing opens without editing menus, and frog taps start a close-up.
- [x] Foliage fades when it blocks a watched frog, holds through brief clear gaps, and returns gradually after 2.5 seconds of clear sight; stopping watch restores it immediately.
- [x] Compact watch cards and habitat settings; precise sliders and terrain tools sit behind disclosures.
- [x] Size controls only for rocks and driftwood; slider release and blur form one undoable gesture, with previews cleared on commit and Undo.
- [x] Static link-preview metadata and an actual-demo image; native sharing and copy-link fallbacks.
- [x] Camera and open settings persist across View/Build; closer default framing and a clear home/reset control. Leaving an animal close-up restores auto-orbit; dragging or keyboard navigation can interrupt the return.
- [x] Reliable tap placement on phones: track native canvas touches, reject drags and multi-touch placement, and allow two-finger panning in every mode. Placement controls sit at the bottom of the viewport.
- [x] Touch-friendly placement rotation: tap left/right or hold to spin. Terrain bars name the active brush.
- [x] Clean branding and a stable rename field.
- [x] Saved terrain sculpting, soil/sand/stone painting, and pool/stream carving, with one undo step per gesture.

## Live animal behavior — first slice implemented

Priority: high. Goal: believable accelerated activity while the app is open, with randomness and visible reasons for behavior. No offline progression, fast-forward or equilibrium calculation.

Implemented now: accelerated hunger/hydration/energy, self-renewing insect colonies, shore soaking, sleep, connected ground/glass routes and a Life tab that lists the inhabitants to watch. See `docs/ECOSYSTEM.md`. Remaining acceptance:

- [x] Species have separate energy, hydration and hunger needs.
- [x] Animals choose among resting, seeking food, bathing and sheltering; sleep follows a sped-up day/night cycle.
- [x] Tree frogs climb glass and connected plant stems and perch on foliage; dart and mossy frogs use appropriate surfaces.
- [x] Species-specific hops, climbs, crawls, and leaf leaps come from the simulation, without a separate renderer movement fallback.
- [x] Rigged frog animation: breathing, crouch and landing, turning on the spot, feet planted while crawling and climbing.
- [x] A gold dust day gecko (rigged CC BY model) with a dash-and-pause gait and resting surfaces.
- [x] Southwestern recolors: long-nosed leopard lizard, desert spiny lizard and plateau fence lizard from the gecko, and a canyon tree frog; the Alpine creek hosts the canyon tree frog and fence lizard.
- [x] Fish steer around actual submerged hardscape and plant geometry, including narrow passages, hollow logs, body size and preferred depth.
- [x] Connected routes over exposed stone and wood meshes, including stacked ledges and plants resting on supports; steep approaches require a climber and mossy frogs keep to low surfaces.
- [x] Quick ballistic hops with separate crouch/flight/landing timing, varied outings and pauses, recent-visit memory, safe ground diagonals, and fixed-step render interpolation.
- [ ] Detailed whole-body land-animal clearance remains; current routes follow surfaces rather than fitting the entire animal mesh through every gap.
- [x] The user can see why an animal is struggling and has a clear way to help.
- [x] Behavior state and decisions live outside React and Three.js. Inject a clock/random source for tests without requiring repeatable gameplay.

## Later: an ecosystem that rewards balance

Priority: medium. Deeper food resources and plant growth can follow the simple breeding and mortality rules below. Begin with one small food web. No money system or large menu stack. Fun and legibility matter more than biological detail.

- [x] Insects breed in colonies under plant and moss cover; capacity follows cover, and the Life panel gives quiet habitat guidance for insect eaters, excluding grazers.
- [x] Plants have soil preferences; struggling plants give less cover.
- [ ] Plant growth over time. Open design questions for Turner: is growth saved with the world, how does it interact with undo, and how should growth look?
- [ ] Decomposers and leaf litter feeding the insects.

## Forgiving life cycles

Direction agreed with Turner on 2026-10-07: default breeding and slow mortality, with a simple shared planting and tank-space budget. Plant requirements are tuning values, not a fixed two-plants rule. No sexes or recurring feeding/misting chores.

- [x] All animal species breed with a healthy same-species adult, producing a juvenile that grows into an adult.
- [x] Planting and space constrain breeding and long-term condition; sustained shortages cause mortality, and old age eventually removes animals.
- [x] Saved age, condition and offspring, with no offline advancement or automatic Undo steps. Undo can restore an earlier population.
- [x] Bounded close-up springtail visuals and life-stage/condition feedback.
- [ ] Longer-term life stages: eggs and tadpoles, researched per species ([#34](https://github.com/turnerburchard/paludarium/issues/34)).
- [ ] Cherry shrimp populations and fish predation ([#35](https://github.com/turnerburchard/paludarium/issues/35)); tiny crabs and other invertebrates ([#36](https://github.com/turnerburchard/paludarium/issues/36)). A vampire crab, stripe-tailed scorpion and desert blonde tarantula walk the land; shoreline and underwater invertebrates are still to come.
- [ ] Higher habitat capacity, with physical-phone profiling before raising the limit ([#37](https://github.com/turnerburchard/paludarium/issues/37)). Temperature and water type remain separate ([#31](https://github.com/turnerburchard/paludarium/issues/31)).

## Art direction and scale

- [x] Preserve owner-supplied frog references under `docs/inspiration/`; use them for faceted skin, terrestrial crouch, markings and splayed digits. Full conversational idea brief is in `docs/PROJECT-BRIEF.md`.

- Artist-authored, rigged GLB animals when further anatomy and animation quality is needed. Preserve species metadata and replace only visual factories.
- More real tropical plants, including better monstera and strawberries; distinct Costa Rican and Mountain West habitats.
- Rocks, flowing water and habitat scales from bowls to large exhibits.
- Crowded-scene profiling and static plant batching are implemented; see `docs/PERFORMANCE.md`. Test physical mobile GPUs before increasing the 120-object cap.

## Product polish

- [x] Optional first-visit introduction to watching, building, local saves and the food web.
- Contextual onboarding: guide one satisfying small habitat before advanced controls.
- Better animal selection and close-up inspection.
- Optional gamification only after building and watching are enjoyable.
- GitHub issues: one actionable task per issue, with acceptance criteria; link larger design decisions back to this file. Use personal repositories only.

## Habitat building and inspiration

- Existing: rotate any selected plant/object with Turn or R; resize tank in Habitat settings.
- Places to go: anthurium and climbing philodendron perches, a leaning branch and a hollow log with bark routes, and dens in the log and under rock shelters. Underwater plants (Amazon sword, eelgrass, rotala, and anubias and java fern, which also grow above water). Leaf litter and four mosses (cushion, sheet and fern moss on land, Java moss in the pool) give insects cover. Any stone or wood piece can grow one of the four mosses over its top from the inspector.
- Terrain tools: sculpt, smooth, paint soil/sand/stone, and carve pools and streams with undoable gestures. Heights and surface paint survive save/export/import and tank resizing.
- Presets should span blank landscaping (dirt/rock/sand/water), small planted starter habitats and complex waterfalls with mature communities.
- Inspiration: Tanks for Nothin-style terrarium videos; a pleasant habitat to tend during breaks.

## Food webs, not name-based diets

Model producers (plants/algae), detritus, microbial decomposition, appropriate small grazers/invertebrates, aquatic shrimp, prey and predators. Species names do not determine diets: a strawberry poison frog is not a strawberry-eater. Research each species' actual diet and habitat before implementing interactions. Nutrient recycling, oxygen and waste should eventually create understandable tradeoffs; do not assume all proposed species can share an enclosure.

## AI-assisted building (long term)

- Text/voice requests compile into validated, previewable editor commands with undo, using the same engine/catalog as manual building.
- Generated assets should conform to documented scale, geometry budget, rig/animation and habitat-placement contracts.
- A species definition includes diet/prey/predators, habitat, size, speed and needs. Generated ecological claims require validation; plausible appearance alone is insufficient.
- Example: “I want a crocodile” requires an appropriately sized habitat, compatible inhabitants and supported behaviors before committing a model to the world.
- Keep the core editor useful without AI or network access.

## Naming decision

The title is **Paludarium**. Keep the saved-world storage key (`little-worlds:v1`) so existing saved habitats continue to work.

## Sharing and observation polish

- [x] Share the current committed world as a compressed snapshot link; explore without replacing a recipient’s save, build a separately saved copy, and keep file backups available in My worlds.
- [x] Replace feed/mist buttons with a field notebook of actual behavior, a quick follow action, and tucked-away inhabitants and habitat guidance.
- [x] Simplify Life to a list of inhabitants with Follow a creature; field notes and habitat guidance were removed from the panel (2026-10-06).
- [ ] Consider richer interactions and ecological discoveries; avoid routine care chores.

- [x] Keep View minimal: remove the title, tagline and large watch button; move the introduction and creature list behind a small info control.

- [x] Multiple locally saved worlds, safe preset exploration, My worlds picker, and file controls inside world and sharing menus.
