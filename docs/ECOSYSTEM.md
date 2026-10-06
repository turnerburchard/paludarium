# Live habitat behavior

## This release

Frog activity runs in a renderer-independent TypeScript engine. Species choose destinations from connected habitat surfaces, guided by hunger, hydration, energy, the simulated day/night period, and unseeded randomness. The engine runs six simulated seconds per visible real second; a day/night cycle lasts five real minutes. These are game-tuning values, not physiological measurements.

Frogs forage for finite insect portions, soak at a shallow shoreline, explore, recover energy, and sleep. Red-eyed and mossy frogs can use connected glass ladders. Dart frogs stay on the ground in this first navigation model. The care panel offers feeding, misting, and a selected frog's needs. Scarcity produces an actionable explanation, not death.

The scene still uses stylized movement, not rigged walking/climbing animation. Fish remain decorative. There is no breeding, mortality, algae, nutrient cycle, waste, or self-balancing food web in this release. Food does not respawn automatically. Plant leaves are not yet navigation surfaces.

## Code boundaries

- `simulation/types.ts`: engine contracts; no rendering types.
- `simulation/navigation.ts`: validated graph and reachable routes.
- `simulation/engine.ts`: bounded live time, needs, decisions, movement, shared food consumption.
- `simulation/species.ts`: behavioral profiles; separate from model geometry.
- `simulation/worldHabitat.ts`: adapter from editor terrain/objects to navigation surfaces. Rocks and wood block ground cells. Plants provide shelter scores. Only shallow shoreline cells admit soaking.
- `simulation/useEcosystem.ts`: React lifecycle and low-frequency HUD snapshots.
- `scene/EcosystemLife.tsx`: advances the engine once per frame, renders feeding patches.
- `scene/Inhabitant.tsx`: reads positions/activities and poses the existing animal mesh.
- `ui/LifePanel.tsx`: care controls and readable needs.

The renderer does not decide where food is, when an animal sleeps, or how needs change. The engine does not know about mesh shape. This separation lets the art thread replace frog geometry without changing behavior.

## Time and saved worlds

No wall-clock catch-up or equilibrium jump exists. Hidden tabs and Pause freeze simulation; editing placement also pauses it. Frame gaps above 250 ms are discarded rather than replayed. Selecting a frog holds its position/needs while inspecting it.

Layout JSON remains version 1. Live activity, food and needs currently restart on reload; the UI explicitly says so. Normal edits retain needs and available food, remapping animals to the new surface graph. New presets/imports with new object IDs start a new session. Runtime state persistence can be added separately, without introducing elapsed offline time.

## Natural-history basis

The following sources support broad categories, not our numerical tuning:

- Smithsonian, [Red-eyed tree frogs](https://nationalzoo.si.edu/animals/news/new-zoo-red-eyed-tree-frogs): nocturnal, adhesive toe pads, invertebrate prey, daytime leaf resting.
- Smithsonian, [Vietnamese mossy frog](https://nationalzoo.si.edu/animals/vietnamese-mossy-frog): nocturnal, semi-aquatic, adhesive pads, insect prey and water/rock refuges.
- Smithsonian, [Poison frogs](https://www.nationalzoo.si.edu/animals/poison-frogs): predominantly diurnal, small insect prey, moist terrestrial habitat. Ground-only routing is a conservative game simplification, not a claim that these species never climb.

Species names do not define diets. In particular, strawberry poison frogs do not consume the strawberry assets. Future food webs should model resources and diets explicitly and verify species compatibility independently of appearance.

## Integration and next steps

Keep rendering changes and simulation changes separate. The engine exposes normal, direction and activity so future rigs can animate sleep, feeding and wall attachment. Plant perches should come from asset-authored anchors, not guessed leaf positions. Navigation currently avoids rocks rather than finding paths over their detailed geometry.

Next: save live needs without advancing while closed; add authored plant/rock surface anchors; rig locomotion; then implement a small producer/grazer/decomposer system with resource conservation and clear feedback before adding reproduction or death.
