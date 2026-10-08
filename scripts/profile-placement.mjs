/** Measure simulation CPU costs without rendering, using a running Vite dev server.
 * Usage: CHROMIUM_PATH=/usr/bin/chromium node scripts/profile-placement.mjs <url> <report.json>
 * Run separately from tests and other browser benchmarks. */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const [
  url = "http://127.0.0.1:5173",
  output = "/tmp/paludarium-placement-profile.json",
] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage();
  await page.route("**/__placement-profile.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Simulation benchmark</body></html>",
    }),
  );
  await page.goto(`${url.replace(/\/$/, "")}/__placement-profile.html`);
  const results = await page.evaluate(async () => {
    const { makePreset } = await import("/src/model/presets.ts");
    const { createWorldEcosystem, createFishSchool } = await import(
      "/src/simulation/worldHabitat.ts"
    );
    const results = [];
    for (const preset of [
      "empty",
      "tropical",
      "mountain",
      "desert",
      "grotto",
      "aquarium",
    ]) {
      const world = makePreset(preset),
        engine = createWorldEcosystem(world),
        fish = createFishSchool(world);
      const next = {
        ...world,
        objects: [
          ...world.objects,
          {
            id: "profile-added",
            kind: "rock",
            x: 0,
            z: 0,
            rotation: 0,
            scale: 0.7,
            seed: 123,
          },
        ],
      };
      // Warm geometry and JIT paths before recording five rebuilds.
      createWorldEcosystem(next, { world, engine });
      createWorldEcosystem(next, { world, engine });
      const builds = [];
      let updated;
      for (let i = 0; i < 5; i++) {
        let start = performance.now();
        updated = createWorldEcosystem(next, { world, engine });
        builds.push(performance.now() - start);
      }
      let start = performance.now();
      const school = createFishSchool(next, { world, fish });
      const fishMs = performance.now() - start;
      const ticks = [];
      for (let i = 0; i < 120; i++) {
        start = performance.now();
        updated.advance(1 / 60);
        school.advance(1 / 60);
        ticks.push(performance.now() - start);
      }
      ticks.sort((a, b) => a - b);
      builds.sort((a, b) => a - b);
      const animal = world.objects.find((object) =>
        engine.observeAnimal(object.id),
      );
      let animalEditMs;
      let reusedGraph;
      if (animal) {
        const moved = {
          ...world,
          objects: world.objects.map((object) =>
            object === animal ? { ...object, x: object.x + 0.1 } : object,
          ),
        };
        start = performance.now();
        const edited = createWorldEcosystem(moved, { world, engine });
        animalEditMs = Math.round(performance.now() - start);
        reusedGraph = edited.graph === engine.graph;
      }
      results.push({
        animalEditMs,
        reusedGraph,
        preset,
        objects: world.objects.length,
        nodes: updated.graph.nodes.size,
        editMedianMs: Math.round(builds[2]),
        editSamplesMs: builds.map(Math.round),
        fishMs: Math.round(fishMs),
        tickMedianMs: +ticks[60].toFixed(2),
        tickP95Ms: +ticks[114].toFixed(2),
        tickMaxMs: +ticks[119].toFixed(2),
      });
    }
    return results;
  });
  console.log(JSON.stringify(results, null, 2));
  await writeFile(
    output,
    `${JSON.stringify({ url, measuredAt: new Date().toISOString(), results }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
