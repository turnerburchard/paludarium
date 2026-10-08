import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

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
    viewport: { width: 960, height: 640 },
    hasTouch: true,
  });
  page.setDefaultTimeout(30000);
  const errors = [];
  let fiberUrl;
  page.on("response", (response) => {
    if (response.url().includes("@react-three_fiber.js"))
      fiberUrl = response.url();
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await page
    .getByRole("dialog", { name: "Controls and help" })
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.locator(".asset-picture img").first().waitFor({ timeout: 90000 });
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Worlds" })
    .locator(".preset-options")
    .getByRole("button", { name: "Empty tank", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Habitat settings", exact: true })
    .click();
  await page.locator("summary", { hasText: "Shape landscape" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Carve stream", exact: true })
      .count(),
    0,
    "the duplicate stream tool is removed",
  );

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
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ),
    );
  }
  async function point(x, z) {
    const y = await page.evaluate(
      async ({ x, z }) => {
        const { groundHeight } = await import("/src/model/terrain.ts");
        return groundHeight(
          x,
          z,
          JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
            key === "" && value.worlds
              ? value.worlds.find((entry) => entry.id === value.activeId).world
              : value,
          ).environment,
        );
      },
      { x, z },
    );
    return page.evaluate(
      async ({ url, x, y, z }) => {
        const { _roots } = await import(url);
        const { camera } = _roots
          .get(document.querySelector("canvas"))
          .store.getState();
        const point = camera.position.clone().set(x, y, z).project(camera);
        const box = document.querySelector("canvas").getBoundingClientRect();
        return {
          x: box.x + ((point.x + 1) * box.width) / 2,
          y: box.y + ((1 - point.y) * box.height) / 2,
        };
      },
      { url: fiberUrl, x, y, z },
    );
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
  await page.getByRole("button", { name: "Paint moss", exact: true }).click();
  const mossFrom = await point(-2.2, -0.7),
    mossTo = await point(-1.2, 0.5);
  await page.mouse.move(mossFrom.x, mossFrom.y);
  await page.mouse.down();
  await page.mouse.move(mossTo.x, mossTo.y, { steps: 16 });
  await page.mouse.up();
  await saved();
  const edge = await point(-3.4, -2.15);
  await page.mouse.click(edge.x, edge.y);
  const mossy = await saved();
  assert.ok(
    mossy.environment.terrain.paint.includes("moss"),
    "moss paints at the tank edge",
  );
  assert.deepEqual(
    mossy.environment.terrain.heights,
    painted.environment.terrain.heights,
    "moss paint retains height",
  );
  await page.screenshot({ path: "/tmp/paludarium-moss-boundary.png" });
  assert.equal(
    await page.getByRole("button", { name: "Carve pool", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Lower ground", exact: true }).click();
  const lower = await point(-2.2, 0.7);
  await page.mouse.click(lower.x, lower.y);
  const lowered = await saved();
  assert.notDeepEqual(
    lowered.environment.terrain.heights,
    mossy.environment.terrain.heights,
    "lower ground edits height",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.screenshot({ path: "/tmp/paludarium-terrain-desktop.png" });
  await page.locator("summary", { hasText: "Fine-tune habitat" }).click();
  const height = page.getByRole("slider", { name: "Tank height", exact: true });
  await height.focus();
  await height.press("End");
  assert.equal((await saved()).environment.height, 6, "height reaches 60 cm");
  await page.getByRole("button", { name: "Full", exact: true }).click();
  assert.equal(
    (await saved()).environment.water,
    5.75,
    "full water follows tank height",
  );
  await height.focus();
  await height.press("Home");
  const shrunk = await saved();
  assert.equal(shrunk.environment.height, 1.5);
  assert.equal(shrunk.environment.water, 1.25, "shrinking clamps water");
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  const restored = await saved();
  assert.equal(restored.environment.height, 6);
  assert.equal(
    restored.environment.water,
    5.75,
    "one undo restores height and water",
  );
  await page.getByRole("button", { name: "Shallow", exact: true }).click();
  const resized = await saved();
  assert.equal(resized.environment.water, 0.44);
  await page.screenshot({ path: "/tmp/paludarium-tall-tank.png" });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page
    .getByRole("button", { name: /^Options for/ })
    .last()
    .click();
  await page.getByRole("button", { name: "Export file", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const download = await downloadPromise;
  const exported = await readFile(await download.path());
  assert.deepEqual(
    JSON.parse(exported.toString()),
    resized,
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
    resized,
    "export and import preserve the landscape",
  );
  await page.reload();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  assert.deepEqual(await saved(), resized, "autosave survives reload");

  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Habitat", exact: true })
    .click();
  await page.locator("summary", { hasText: "Shape landscape" }).click();
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
    "PASS: terrain drag, whole-stroke undo/redo, paint, tank height, water limits, reset, export/import, reload, mobile touch, runtime errors",
  );
} finally {
  await browser?.close();
  server.kill();
}
