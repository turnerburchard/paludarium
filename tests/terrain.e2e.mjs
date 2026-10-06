import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PerspectiveCamera, Vector3 } from "three";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5192";
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    root,
    "--host",
    "127.0.0.1",
    "--port",
    "5192",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      ready = (await fetch(url)).ok;
      if (ready) break;
    } catch {
      /* Server is starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "terrain test server starts");
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    hasTouch: true,
  });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await page.locator(".asset-picture img").first().waitFor();
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  await page.getByRole("button", { name: "New world", exact: true }).click();
  await page.getByRole("button", { name: /Empty tank/ }).click();
  await page
    .getByRole("button", { name: "Habitat settings", exact: true })
    .click();

  async function saved() {
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector(".save-status")
          ?.textContent?.includes("Saved on this device"),
      null,
      { timeout: 30000 },
    );
    return page.evaluate(() =>
      JSON.parse(localStorage.getItem("little-worlds:v1")),
    );
  }
  async function point(x, z) {
    const y = await page.evaluate(
      async ({ x, z }) => {
        const { groundHeight } = await import("/src/model/terrain.ts");
        return groundHeight(
          x,
          z,
          JSON.parse(localStorage.getItem("little-worlds:v1")).environment,
        );
      },
      { x, z },
    );
    const box = await page.locator("canvas").boundingBox();
    const aspect = box.width / box.height,
      fit = Math.max(1, 1.12 / aspect);
    const camera = new PerspectiveCamera(36, aspect, 0.1, 100);
    camera.position.set(9 * fit, 7.5 * fit, 11 * fit);
    camera.lookAt(0, 0.8, 0);
    camera.updateMatrixWorld();
    const p = new Vector3(x, y, z).project(camera);
    return {
      x: box.x + ((p.x + 1) / 2) * box.width,
      y: box.y + ((1 - p.y) / 2) * box.height,
    };
  }
  const original = await saved();
  await page.getByRole("button", { name: "Raise ground", exact: true }).click();
  const from = await point(-1.75, 0),
    to = await point(-1.05, 0.4);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  assert.deepEqual(
    await saved(),
    original,
    "an unfinished stroke is not autosaved",
  );
  await page.mouse.up();
  const sculpted = await saved();
  assert.ok(
    sculpted.environment.terrain.heights.some((height) => height > 0),
    "drag raises terrain",
  );
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  assert.deepEqual(
    await saved(),
    original,
    "one undo reverses the whole stroke",
  );
  await page
    .getByRole("button", { name: "Redo (⌘/Ctrl Shift Z)", exact: true })
    .click();
  assert.deepEqual(await saved(), sculpted, "redo restores the whole stroke");

  const cancelFrom = await point(-1.75, 0),
    cancelTo = await point(-1.4, 0.2);
  await page.mouse.move(cancelFrom.x, cancelFrom.y);
  await page.mouse.down();
  await page.mouse.move(cancelTo.x, cancelTo.y, { steps: 4 });
  await page.keyboard.press("Control+z");
  await page.mouse.up();
  assert.deepEqual(
    await saved(),
    sculpted,
    "undo during a stroke cancels only the preview, preserving the previous edit",
  );

  await page.getByRole("button", { name: "Paint sand", exact: true }).click();
  const sand = await point(-1.75, 0);
  await page.mouse.click(sand.x, sand.y);
  const painted = await saved();
  assert.ok(
    painted.environment.terrain.paint.includes("sand"),
    "sand is painted",
  );
  assert.deepEqual(
    painted.environment.terrain.heights,
    sculpted.environment.terrain.heights,
    "paint retains height",
  );
  await page.getByRole("button", { name: "Carve pool", exact: true }).click();
  const pool = await point(-2.2, 0.7);
  await page.mouse.click(pool.x, pool.y);
  const pooled = await saved();
  assert.ok(
    await page.evaluate(async () => {
      const { groundHeight } = await import("/src/model/terrain.ts");
      const env = JSON.parse(
        localStorage.getItem("little-worlds:v1"),
      ).environment;
      return groundHeight(-2.2, 0.7, env) < env.water - 0.12;
    }),
    "carved pool fills with usable water",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.screenshot({ path: "/tmp/paludarium-terrain-desktop.png" });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export world", exact: true }).click();
  const download = await downloadPromise;
  const exported = await readFile(await download.path());
  assert.deepEqual(
    JSON.parse(exported.toString()),
    pooled,
    "export includes terrain data",
  );
  await page
    .getByRole("button", { name: "Reset landscape", exact: true })
    .click();
  assert.equal((await saved()).environment.terrain, undefined);
  await page.locator("input[type=file]").setInputFiles({
    name: "landscape.json",
    mimeType: "application/json",
    buffer: exported,
  });
  assert.deepEqual(
    await saved(),
    pooled,
    "export and import preserve the landscape",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  assert.deepEqual(await saved(), pooled, "autosave survives reload");

  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Habitat", exact: true })
    .click();
  await page.getByRole("button", { name: "Lower ground", exact: true }).click();
  const mobileBefore = await saved(),
    tap = await point(-1.2, -0.2);
  assert.equal(
    await page.locator(".app").evaluate((app) => app.scrollTop),
    0,
    "closing the sheet cannot scroll the scene out of view",
  );
  await page
    .waitForFunction(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName === "CANVAS",
      tap,
    )
    .catch(async (error) => {
      console.log(
        "Mobile brush target",
        tap,
        await page.evaluate(({ x, y }) => {
          const hit = document.elementFromPoint(x, y);
          const rect = document.querySelector("canvas").getBoundingClientRect();
          return {
            hit: hit?.tagName,
            className: hit?.className,
            canvas: rect.toJSON(),
            app: document.querySelector(".app").className,
          };
        }, tap),
      );
      await page.screenshot({ path: "/tmp/paludarium-terrain-failure.png" });
      throw error;
    });
  await page.touchscreen.tap(tap.x, tap.y);
  assert.notDeepEqual(
    (await saved()).environment.terrain.heights,
    mobileBefore.environment.terrain.heights,
    "touch sculpts terrain",
  );
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  assert.deepEqual(await saved(), mobileBefore, "touch stroke is undoable");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "no mobile overflow",
  );
  await page.screenshot({ path: "/tmp/paludarium-terrain-mobile.png" });
  assert.deepEqual(errors, [], "no terrain browser errors");
  console.log(
    "PASS: terrain drag, whole-stroke undo/redo, paint, pool, reset, export/import, reload, mobile touch, runtime errors",
  );
} finally {
  await browser?.close();
  server.kill();
}
