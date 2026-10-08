# Rendering measurements

The object limit remains 120. Static plants and hardscape are batched by material within each object; animals retain separate parts for animation. Terrain pebbles use one instanced mesh. Water ripples and their surface normals run in the vertex shader, updating one time uniform instead of rewriting 1,189 vertices and rebuilding normals every frame. The renderer observes live animal state without allocating a copied snapshot per animal per frame.

## Crowded scene

Measured on October 6, 2026, in the same cloud environment with Chromium 151, device pixel ratio 1, and ANGLE SwiftShader. Each scene contains 120 seeded objects: 30 each of moss, fern, grass, and monstera, at scale 0.55. Thumbnails finish before a ten-second sample begins. The baseline is commit `4f004e9`; the result includes the batching, instancing, GPU water, and current simulation changes.

| Viewport   | Measurement             |             Before |              After |
| ---------- | ----------------------- | -----------------: | -----------------: |
| 1440 × 960 | Median draw calls/frame |              7,716 |                475 |
| 1440 × 960 | Meshes                  |              7,710 |                469 |
| 1440 × 960 | Mean frames/second      |               0.95 |               1.09 |
| 1440 × 960 | Median / p95 frame time |   1,300 / 1,350 ms | 1,050 / 1,166.5 ms |
| 390 × 844  | Median draw calls/frame |              7,715 |                475 |
| 390 × 844  | Mean frames/second      |               1.28 |               2.49 |
| 390 × 844  | Median / p95 frame time | 733.3 / 1,083.4 ms |   433.3 / 466.7 ms |

Draw calls fell about 94%. Rendered triangles stay around 79,000; batching reduces submission overhead rather than simplifying the models. Tests check transformed bounds, triangle counts, vertex colors, and independent materials for placement previews.

SwiftShader renders on the CPU, and the desktop sample contains only ten to twelve frames. These timings describe this software-renderer stress test, not expected hardware frame rates. A phone viewport is not a physical phone GPU. Profile real devices before increasing the cap or claiming a frame-rate target. The current experiment does not measure a tank full of animated frogs or sustained thermal behavior.

Both samples used the earlier sidebar layout. Subsequent phone UI changes give the canvas more space, so run the script again when measuring the current phone layout.

## Reproduce

Start a development server, then run:

```sh
CHROMIUM_PATH=/usr/bin/chromium node scripts/profile.mjs http://127.0.0.1:5173 /tmp/profile.json
```

Omit `CHROMIUM_PATH` to use Playwright's installed Chromium. The script seeds browser storage, samples both viewports, checks for runtime errors, and writes JSON. Run one browser benchmark at a time; parallel browser checks distort the measurements.

For a baseline comparison, extract the named commit into a temporary directory, install its locked dependencies, and serve it on another port. Profile each revision sequentially with the same browser and machine.

## Production bundle

The previous production build shipped one 1,458 KB JavaScript chunk (385 KB gzip). The current build separates React, Three.js core, its renderer, scene controls, and application code. The five chunks range from 198 to 376 KB, with roughly 395 KB gzip in total. This improves cache reuse and removes the oversized application chunk; it does not reduce the total first-load transfer. Vite's default 500 KB warning is restored rather than suppressed.

## Placement and navigation

Placing an object rebuilds navigation synchronously, so its CPU cost blocks
simulation, input and animation together. Land collision queries now share the
fish collision hierarchy builder and visit only candidate triangles. Ground,
plant-anchor and leaf connections use spatial buckets rather than scanning every
node. Candidate and triangle tie ordering is preserved. Animal decisions find
nearest destinations with a linear scan and check occupied destinations through
the existing set. Navigation copies its known vector and neighbor fields directly
instead of invoking structured cloning for every node.

Animal-only edits reuse the navigation graph when the environment, static objects
and maximum animal footprint are unchanged. Changing that footprint, terrain,
hardscape or plants still rebuilds it. Metadata-only edits keep the live simulation
and its current routes. Habitat support is calculated when the world changes,
rather than on every HUD snapshot.

Measured in Chromium 151 on the same four-CPU cloud host. The baseline is
`254f4278`. Each sample appends one rock at `(0, 0)`, scale 0.7, seed 123, to a
preset; timings are the median of five land-ecosystem rebuilds after two warmups. Measurements
load the simulation modules into a blank browser page and exclude React updates,
WebGL rendering, thumbnails, persistence and pointer handling. Run benchmarks
without competing tests or browser workloads.

| Preset           | Navigation nodes |   Before |  After |
| ---------------- | ---------------: | -------: | -----: |
| Cloud forest     |            4,788 |   680 ms | 329 ms |
| Alpine creek     |            5,123 | 1,159 ms | 489 ms |
| Desert spring    |            5,110 | 1,160 ms | 264 ms |
| Limestone grotto |            5,166 | 1,940 ms | 268 ms |
| Aquarium         |            3,975 |   964 ms | 179 ms |

Populated navigation rebuild medians were 52–86% shorter in this repeat.
Animal-only land-ecosystem updates took 1–5 ms instead of 563–2,265 ms and reused
their graph. Empty-tank rock placement measured 112 versus 18 ms after warmup.
An earlier three-sample run showed 42–64% shorter populated rebuilds but substantial
cold small-scene variability. These short cloud measurements are not device
frame-rate targets or startup measurements; individual rebuild samples varied
considerably, especially in the baseline grotto (1,661–3,410 ms).

These figures exclude fish-space reconstruction: aquarium placement still spent
about 324 ms rebuilding that space. Geometry edits still block for hundreds of
milliseconds and remain worth optimizing.

A separate comparison against the original implementation checked complete node
records and neighbor ordering for all six presets, both initially and after rock
placement. Seeded animal snapshots after 600 updates also matched. Regression
tests cover ray hits at mesh edges and vertices, spatial-cell boundaries, graph
isolation and the inputs that require rebuilding navigation. Rendering geometry,
animal rules and object limits were not reduced.

To reproduce CPU measurements, start the Vite development server and run:

```sh
CHROMIUM_PATH=/usr/bin/chromium node scripts/profile-placement.mjs \
  http://127.0.0.1:5173 /tmp/placement-profile.json
```

The script also reports fish-space construction, a short simulation-update sample
and whether an animal-only edit reuses the graph. It can be copied into a baseline
checkout to run the same measurement there.
