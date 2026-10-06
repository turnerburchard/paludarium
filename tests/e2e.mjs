/** Browser smoke test. Run `npx playwright install chromium` once, then `npm run test:e2e`.
 * CHROMIUM_PATH optionally selects an existing Chromium executable (useful in containers).
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PerspectiveCamera, Vector3 } from "three";
const root = fileURLToPath(new URL("../", import.meta.url));
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    root,
    "--host",
    "127.0.0.1",
    "--port",
    "5191",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
let browser;
const storageKey = "little-worlds:v1";
try {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch("http://127.0.0.1:5191");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
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
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5191");
  await page.locator(".asset-picture img").first().waitFor();
  // A first visit opens on the cloud forest; start from an empty tank.
  assert.equal(
    await page.getByRole("textbox", { name: "World name" }).inputValue(),
    "Cloud forest",
    "first visit opens on a finished habitat",
  );
  await page.getByRole("button", { name: "New world", exact: true }).click();
  await page.getByRole("button", { name: /Empty tank/ }).click();
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  async function saved() {
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.waitForFunction(() =>
      document
        .querySelector(".save-status")
        ?.textContent?.includes("Saved on this device"),
    );
    return page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      storageKey,
    );
  }
  async function point(x, y, z) {
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
  async function clickWorld(x, y, z) {
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const p = await point(x, y, z);
    await page.mouse.move(p.x, p.y);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.mouse.click(p.x, p.y, { delay: 80 });
  }
  await page
    .getByRole("button", { name: "Red-eyed tree frog", exact: true })
    .click();
  await clickWorld(-1.4, 0.76, 0.75);
  assert.equal((await saved()).objects.length, 1, "place a frog");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  let world = await saved();
  const frog = world.objects[0];
  await clickWorld(frog.x, 0.95, frog.z);
  await page.getByRole("button", { name: "Copy", exact: true }).waitFor();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(
    (await saved()).objects.length,
    1,
    "canceling a copy must leave no object",
  );
  await clickWorld(frog.x, 0.95, frog.z);
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await page.keyboard.press("r");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(
    (await saved()).objects[0].rotation,
    frog.rotation,
    "cancel move must also cancel rotation",
  );
  await clickWorld(frog.x, 0.95, frog.z);
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await clickWorld(-2.0, 0.76, 0.15);
  world = await saved();
  if (Math.abs(world.objects[0].x - frog.x) <= 0.2) {
    console.log(
      "move failure",
      frog,
      world.objects[0],
      await page.locator(".status-message").textContent(),
    );
    await page.screenshot({ path: "/tmp/move-failure.png" });
  }
  assert.ok(
    Math.abs(world.objects[0].x - frog.x) > 0.2,
    "move updates position",
  );
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  assert.equal((await saved()).objects[0].x, frog.x, "undo move");
  await clickWorld(frog.x, 0.95, frog.z);
  await page.getByRole("button", { name: "Watch up close" }).click();
  await page.getByRole("complementary", { name: "Watching" }).waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("complementary", { name: "Watching" })
    .waitFor({ state: "detached" });
  await page.getByRole("button", { name: "New world", exact: true }).click();
  await page.getByRole("button", { name: /Cloud forest.*Monstera/ }).click();
  world = await saved();
  assert.equal(world.name, "Cloud forest");
  assert.ok(world.objects.length > 20);
  await page.reload();
  await page.locator(".asset-picture img").first().waitFor();
  assert.equal(
    (await saved()).name,
    "Cloud forest",
    "autosave survives reload",
  );
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  await page.getByRole("button", { name: "Habitat life", exact: true }).click();
  const life = page.getByRole("region", { name: "Habitat life", exact: true });
  const beforeFood = Number(
    (await life.locator("small").textContent()).match(/\d+/)[0],
  );
  await page
    .getByRole("button", { name: "Scatter insects", exact: true })
    .click();
  await page.waitForFunction((before) => {
    const text = document.querySelector(".life-panel small")?.textContent ?? "";
    return Number(text.match(/\d+/)?.[0]) > before;
  }, beforeFood);
  await page.getByRole("button", { name: "Mist habitat", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export world", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "cloud-forest.json");
  const invalidBefore = await saved();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  assert.deepEqual(
    await saved(),
    invalidBefore,
    "invalid import preserves existing world",
  );
  // With life paused, a changed canvas verifies keyboard camera movement.
  await page.locator("canvas").click({ position: { x: 20, y: 20 } });
  const beforeMove = await page.locator("canvas").screenshot();
  await page.keyboard.down("w");
  await page.waitForTimeout(700);
  await page.keyboard.up("w");
  const afterMove = await page.locator("canvas").screenshot();
  assert.notDeepEqual(afterMove, beforeMove, "W moves the camera");
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  await page.screenshot({
    path: process.env.SCREENSHOT_DIR
      ? `${process.env.SCREENSHOT_DIR}/desktop.png`
      : "/tmp/terrarium-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "no mobile horizontal overflow",
  );
  await page
    .getByRole("button", { name: "Habitat settings", exact: true })
    .click();
  const water = page.getByRole("slider", { name: "Water level", exact: true });
  await water.focus();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Water level",
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Tab");
  await page.waitForFunction(
    (before) =>
      JSON.parse(localStorage.getItem("little-worlds:v1")).environment.water >
      before,
    world.environment.water,
  );

  await page
    .getByRole("button", { name: "Add to your world", exact: true })
    .click();
  await page.screenshot({
    path: process.env.SCREENSHOT_DIR
      ? `${process.env.SCREENSHOT_DIR}/mobile.png`
      : "/tmp/terrarium-mobile.png",
  });
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(
    "PASS: first-visit preset, placement, selection, canceled copy/move, move, undo, watch, presets, persistence, export, invalid import, mobile layout, keyboard slider, runtime errors",
  );
} finally {
  await browser?.close();
  server.kill();
}
