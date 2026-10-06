/** Profile a running dev server with a crowded, saved 120-object habitat.
 * Usage: CHROMIUM_PATH=/usr/bin/chromium node scripts/profile.mjs <url> <report.json>
 * Browser timings depend on hardware. Headless SwiftShader is a stress check,
 * not a substitute for testing a physical phone. */
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const [url = "http://127.0.0.1:5173", output = "/tmp/paludarium-profile.json"] =
  process.argv.slice(2);
const world = {
  version: 1,
  name: "Crowded habitat",
  environment: {
    width: 7,
    depth: 4.5,
    substrate: 0.25,
    water: 0.44,
    light: "day",
    warmth: 0.45,
    brightness: 1,
  },
  objects: Array.from({ length: 120 }, (_, index) => ({
    id: `profile-${index}`,
    kind: ["moss", "fern", "grass", "monstera"][index % 4],
    x: -2.85 + (index % 10) * 0.25,
    z: -1.7 + Math.floor(index / 10) * 0.31,
    rotation: (index * 0.7) % (2 * Math.PI),
    scale: 0.55,
    seed: index * 173,
  })),
};
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const results = [];
try {
  for (const viewport of [
    { width: 1440, height: 960 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 1,
      hasTouch: true,
    });
    let fiberUrl;
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("@react-three_fiber.js"))
        fiberUrl = response.url();
    });
    await page.addInitScript(
      (saved) =>
        localStorage.setItem("little-worlds:v1", JSON.stringify(saved)),
      world,
    );
    await page.goto(url);
    await page.getByRole("button", { name: "Build", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelectorAll(".asset-picture img").length === 13,
      null,
      { timeout: 120000 },
    );
    assert.ok(fiberUrl, "the running scene loaded React Three Fiber");
    const measurement = await page.evaluate(async (moduleUrl) => {
      const { _roots } = await import(moduleUrl);
      const store = _roots.get(document.querySelector("canvas")).store;
      const { gl, scene } = store.getState();
      const context = gl.getContext(),
        debug = context.getExtension("WEBGL_debug_renderer_info");
      const renderer = debug
        ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : "unavailable";
      let meshes = 0;
      scene.traverse((object) => {
        if (object.isMesh) meshes++;
      });
      const intervals = [],
        calls = [],
        triangles = [];
      await new Promise((resolve) => {
        const start = performance.now();
        let previous = start;
        function frame(now) {
          intervals.push(now - previous);
          previous = now;
          calls.push(gl.info.render.calls);
          triangles.push(gl.info.render.triangles);
          if (now - start >= 10000) resolve();
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      const percentile = (values, fraction) =>
        [...values].sort((a, b) => a - b)[
          Math.floor((values.length - 1) * fraction)
        ];
      const meanFrameMs =
        intervals.reduce((sum, n) => sum + n, 0) / intervals.length;
      return {
        renderer,
        meshes,
        frames: intervals.length,
        fps: Math.round((1000 / meanFrameMs) * 100) / 100,
        medianFrameMs: percentile(intervals, 0.5),
        p95FrameMs: percentile(intervals, 0.95),
        drawCalls: percentile(calls, 0.5),
        triangles: percentile(triangles, 0.5),
      };
    }, fiberUrl);
    assert.deepEqual(errors, [], "no runtime errors in the crowded scene");
    const result = { viewport, objects: world.objects.length, ...measurement };
    results.push(result);
    console.log(JSON.stringify(result));
    await page.close();
  }
  await writeFile(
    output,
    `${JSON.stringify({ url, measuredAt: new Date().toISOString(), results }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
