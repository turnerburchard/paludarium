# Paludarium work tracker

Keep completed work separate from proposed work; an idea is not automatically part of the next release.

## Current release

- [x] Species catalog: red-eyed tree frog, strawberry poison frog, blue poison dart frog, Vietnamese mossy frog; botanical names for identifiable plants.
- [x] Continuous frog anatomy with folded legs, smaller eyes, toe pads and species markings.
- [x] Desktop WASD camera movement, Shift for faster movement, typing/modal guards.
- [x] Dark studio background, overhead illumination, saved warmth and brightness controls.
- [x] Separate glass from soil faces; match sidewall and surface subdivisions.
- [x] Published at turnerburchard.com/paludarium/ (GitHub Pages from this repo, deployed by CI on every push to `main`).
- [x] Clean phone layout: full-screen scene, bottom dock, panels as a sheet; first visit opens on the Cloud forest.
- [x] Separate View/Build modes: viewing opens without editing menus, and frog taps start a close-up.
- [x] Foliage fades when it blocks a watched frog and restores when watching ends.
- [x] Compact watch cards and habitat settings; precise sliders and terrain tools sit behind disclosures.
- [x] Size controls only for rocks and driftwood; slider release and blur form one undoable gesture.
- [x] Saved terrain sculpting, soil/sand/stone painting, and pool/stream carving, with one undo step per gesture.

## Live animal behavior — first slice implemented

Priority: high. Goal: believable accelerated activity while the app is open, with randomness and visible reasons for behavior. No offline progression, fast-forward or equilibrium calculation.

Implemented now: accelerated hunger/hydration/energy, finite insect feeding, misting, shore soaking, sleep, connected ground/glass routes and the Habitat life panel. See `docs/ECOSYSTEM.md`. Remaining acceptance:
- [x] Species have separate energy, hydration and hunger needs.
- [x] Animals choose among resting, seeking food, bathing and sheltering; sleep follows a sped-up day/night cycle.
- [x] Tree frogs climb glass and connected plant stems and perch on foliage; dart and mossy frogs use appropriate surfaces.
- [x] Species-specific hops, climbs, crawls, and leaf leaps come from the simulation, without a separate renderer movement fallback.
- [x] Rigged frog animation: breathing, crouch and landing, turning on the spot, feet planted while crawling and climbing.
- [ ] Detailed collision meshes remain.
- [x] The user can see why an animal is struggling and has a clear way to help.
- [x] Behavior state and decisions live outside React and Three.js. Inject a clock/random source for tests without requiring repeatable gameplay.

## Later: an ecosystem that rewards balance

Priority: medium. Food resources, plant growth, crowding and reproduction; eventually mortality. Begin with one small food web. Explain imbalances gently before introducing losses. No money system or large menu stack. Fun and legibility matter more than biological detail.

- [x] Insects breed in colonies under plant and moss cover; capacity follows cover, and the Life panel shows how many frogs they can feed.
- [x] Plants have soil preferences; struggling plants give less cover.
- [ ] Plant growth over time. Open design questions for Turner: is growth saved with the world, how does it interact with undo, and how should growth look?
- [ ] Decomposers and leaf litter feeding the insects.

## Art direction and scale

- [x] Preserve owner-supplied frog references under `docs/inspiration/`; use them for faceted skin, terrestrial crouch, markings and splayed digits. Full conversational idea brief is in `docs/PROJECT-BRIEF.md`.

- Artist-authored, rigged GLB animals when further anatomy and animation quality is needed. Preserve species metadata and replace only visual factories.
- More real tropical plants, including better monstera and strawberries; distinct Costa Rican and Mountain West habitats.
- Rocks, flowing water and habitat scales from bowls to large exhibits.
- Crowded-scene profiling and static plant batching are implemented; see `docs/PERFORMANCE.md`. Test physical mobile GPUs before increasing the 120-object cap.

## Product polish

- Contextual onboarding: one satisfying small habitat before advanced controls.
- Better animal selection and close-up inspection.
- Optional gamification only after building and watching are enjoyable.
- GitHub issues: one actionable task per issue, with acceptance criteria; link larger design decisions back to this file. Use personal repositories only.

## Habitat building and inspiration

- Existing: rotate any selected plant/object with Turn or R; resize tank in Habitat settings.
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
