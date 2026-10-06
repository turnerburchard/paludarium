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

## Reproduce

Start a development server, then run:

```sh
CHROMIUM_PATH=/usr/bin/chromium node scripts/profile.mjs http://127.0.0.1:5173 /tmp/profile.json
```

Omit `CHROMIUM_PATH` to use Playwright's installed Chromium. The script seeds browser storage, samples both viewports, checks for runtime errors, and writes JSON. Run one browser benchmark at a time; parallel browser checks distort the measurements.

For a baseline comparison, extract the named commit into a temporary directory, install its locked dependencies, and serve it on another port. Profile each revision sequentially with the same browser and machine.

## Production bundle

The previous production build shipped one 1,458 KB JavaScript chunk (385 KB gzip). The current build separates React, Three.js core, its renderer, scene controls, and application code. The five chunks range from 198 to 376 KB, with roughly 395 KB gzip in total. This improves cache reuse and removes the oversized application chunk; it does not reduce the total first-load transfer. Vite's default 500 KB warning is restored rather than suppressed.
