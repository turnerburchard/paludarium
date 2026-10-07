# Live habitat behavior

## This release

Frog activity runs in a renderer-independent TypeScript engine. Species choose destinations from connected habitat surfaces, guided by hunger, hydration, energy, the simulated day/night period, and unseeded randomness. The engine runs six simulated seconds per visible real second; a day/night cycle lasts five real minutes. These are game-tuning values, not physiological measurements.

Frogs forage for finite insect portions, soak at a shallow shoreline, explore, recover energy, and sleep. Red-eyed and mossy frogs can use connected glass ladders and plant stems. Tree frogs prefer sheltered leaves for daytime sleep and can leap between nearby perches. Mossy frogs crawl and use low perches; dart frogs make short hops along the ground. The watch card shows an animal’s needs. The Life panel lists inhabitants to follow; there are no routine feed or mist chores, and scarcity does not cause death.

Frogs use rigged crouch, jump and landing clips, breathing, and planted feet while walking or climbing. Geckos dash and pause with a rigged gait. Fish swim as a loose school (see below) but have no needs yet. Insects are the first self-balancing resource (see below). There is no frog breeding, mortality, algae, nutrient cycle or waste yet.

Monstera, bromeliad, and fern definitions provide seeded stem routes, leaf positions, and surface normals from the same geometry data used to build the plants. Rotation and scale apply to those anchors. A plant needs a dry connection to nearby ground or its stone/wood support; disconnected or submerged plants are not reachable. Nearby leaves within 0.65 scene units admit a tree-frog leap. Removing or moving a plant remaps the frog to a reachable surface while preserving its needs.

Stone and wood routes come from their actual collision geometry: connected mesh vertices, edge samples and face centers follow the exposed skin, including steep sides. Nodes and edges buried inside overlapping pieces are removed. Nearby touching pieces connect across stacks; isolated or floating pieces stay disconnected. Non-climbers only use gentle surfaces and approaches. Mossy frogs’ perch-height limit includes the height of the support under a plant. This is surface navigation, not detailed whole-body clearance.

Ground routes include diagonals without cutting blocked or flooded corners. Routing uses physical distance, so fine mesh sampling does not penalize stone routes. Straight, gentle stretches can form one movement segment. Explorers choose outings of varying length, with a mild heading preference and a memory of recent visits; pauses, pace and idle glances use the injected random source. A sleeping animal stays at its perch until needs or the day/night phase call it away.

Hops use their own burst timing rather than the slow crawling speed: roughly 0.4 real seconds at the normal six-times clock, including a short crouch, constant forward flight with a parabolic lift, and landing. Short pauses separate hops. Crawlers turn through small route bends without stopping at every facet, while larger changes still cause a pivot.

The engine exposes position, normal, hop lift, and tilt. `observeRenderedAnimal` interpolates the last two fixed steps using the remaining simulation time; landing interpolation finishes the hop rather than rewinding its clip. This adds one step of display latency without easing quick jumps into slow motion. Once an edge starts, it completes before a new decision redirects the frog. The renderer reads that pose; it never invents an independent hop. Sculpted heights feed placement, shoreline detection, and navigation through `groundHeight`. Terrain strokes preview visually while the simulation pauses, and rebuild navigation once on release.

## Insects

Insects live in colonies on sheltered, dry ground. `insectColonies` in `worldHabitat.ts` picks the most sheltered spots (shelter comes from nearby plants and moss), up to eight, at least a scene unit apart; a colony's capacity is five portions times its shelter. Bare ground has no colonies.

Each simulation step a colony below capacity grows logistically: `growth × (insects + arrivals) × (1 − insects / capacity)`. Growth is fastest at half capacity, so a colony that frogs keep about half eaten feeds them best. The small `arrivals` term means an eaten-out colony slowly recovers instead of going extinct. Food outside a colony has zero capacity and doesn't breed.

`insectEatersSupported` turns total colony capacity into an approximate number of frogs fed indefinitely, using the same constants as the engine. The Life panel uses it for tucked-away advice to add cover, counting insect eaters rather than grazers. There are no feed or mist buttons: lasting habitat changes are the interaction. Edits keep insects: a patch whose spot is still a colony joins it; otherwise it stays as scattered food.

## Fish

`simulation/fish.ts` is a small, separate school simulation. Each fish keeps a slightly different pace and a slowly drifting turning rate, lines up with and drifts toward fish within about a scene unit, keeps a little personal space, and looks ahead so it turns away from the shore before reaching it. "Water" is exactly where a fish may be placed (`placementProblem`), so swimming and placement can't disagree. Fish keep their positions through ordinary edits unless they were moved or their spot dried out. They don't eat, tire or breed yet.

## Code boundaries

- `simulation/types.ts`: engine contracts; no rendering types.
- `simulation/navigation.ts`: validated graph, species permissions and shortest physical routes.
- `simulation/engine.ts`: bounded live time, needs, decisions, movement, shared food consumption.
- Frog behavior profiles (nocturnal, climbs, speed) live on each frog's asset definition in `src/assets/animals/frogs.ts`.
- `assets/collisionShape.ts`: cached baked asset triangles, shared by land and fish geometry adapters; temporary models are disposed.
- `simulation/landSurfaces.ts`: exposed hardscape routes and solid-interior checks.
- `simulation/worldHabitat.ts`: adapter from editor terrain/objects to connected ground, glass, hardscape, stem/leaf and den routes. Only shallow shoreline surfaces admit soaking.
- `simulation/useEcosystem.ts`: React lifecycle and low-frequency HUD snapshots.
- `scene/EcosystemLife.tsx`: advances the engine once per frame, renders feeding patches.
- `scene/Inhabitant.tsx`: reads positions/activities and poses the existing animal mesh.
- `simulation/discoveries.ts`: recognizes observed arrivals and behaviors, rather than planned routes. The engine keeps one note per behavior and carries those notes across ordinary edits.
- `ui/LifePanel.tsx`: inhabitants and follow action. Needs remain available inside the watch card.

The renderer does not decide where food is, when an animal sleeps, or how needs change. The engine consumes surface nodes and routes; geometry adapters sample the mesh shape. This separation lets the art thread replace frog geometry without changing behavior.

## Time and saved worlds

No wall-clock catch-up or equilibrium jump exists. Hidden tabs and Pause freeze simulation; editing placement also pauses it. Frame gaps above 250 ms are discarded rather than replayed. Selecting a frog holds its position/needs while inspecting it.

Layout JSON remains version 1. Live activity, food, needs and field notes currently restart on reload; the UI explicitly says so. Normal edits retain needs and available food, remapping animals to the new surface graph. New presets/imports with new object IDs start a new session. Runtime state persistence can be added separately, without introducing elapsed offline time.

## Natural-history basis

The following sources support broad categories, not our numerical tuning:

- Smithsonian, [Red-eyed tree frogs](https://nationalzoo.si.edu/animals/news/new-zoo-red-eyed-tree-frogs): nocturnal, adhesive toe pads, invertebrate prey, daytime leaf resting.
- Smithsonian, [Vietnamese mossy frog](https://nationalzoo.si.edu/animals/vietnamese-mossy-frog): nocturnal, semi-aquatic, adhesive pads, insect prey and water/rock refuges.
- Smithsonian, [Poison frogs](https://www.nationalzoo.si.edu/animals/poison-frogs): predominantly diurnal, small insect prey, moist terrestrial habitat. Ground-only routing is a conservative game simplification, not a claim that these species never climb.

Species names do not define diets. In particular, strawberry poison frogs do not consume the strawberry assets. Future food webs should model resources and diets explicitly and verify species compatibility independently of appearance.

## Integration and next steps

Keep rendering changes and simulation changes separate. The engine exposes normal, direction, activity and motion so future rigs can animate sleep, feeding and wall attachment. Plant perches come from asset-authored anchors; hardscape routes come from the exposed geometry. The importable `examples/stacked-lookout.json` demonstrates a planted stack.

Next: improve whole-body clearance through tight gaps; save live needs without advancing while closed; then implement a small producer/grazer/decomposer system with resource conservation and clear feedback before adding reproduction or death.
