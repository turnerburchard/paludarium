/** Browser smoke test. Run `npx playwright install chromium` once, then `npm run test:e2e`.
 * CHROMIUM_PATH optionally selects an existing Chromium executable (useful in containers).
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
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
    viewport: { width: 960, height: 640 },
  });
  const errors = [];
  let fiberUrl;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("@react-three_fiber.js"))
      fiberUrl = response.url();
  });
  await page.goto("http://127.0.0.1:5191");
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.locator(".asset-picture img").first().waitFor({ timeout: 90000 });
  // A first visit opens on the aquarium; start from an empty tank.
  assert.equal(
    await page.getByRole("textbox", { name: "World name" }).inputValue(),
    "Aquarium",
    "first visit opens on a finished habitat",
  );
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Worlds" })
    .locator(".preset-options")
    .getByRole("button", { name: "Empty tank", exact: true })
    .click();
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
      (key) =>
        JSON.parse(localStorage.getItem(key), (key, value) =>
          key === "" && value.worlds
            ? value.worlds.find((entry) => entry.id === value.activeId).world
            : value,
        ),
      storageKey,
    );
  }
  async function point(x, y, z) {
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
  await page.getByRole("button", { name: "Animals", exact: true }).click();
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
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await page.keyboard.press("Control+z");
  assert.equal((await saved()).objects.length, 0, "undo placing the frog");
  assert.equal(
    await page.getByRole("button", { name: "Cancel", exact: true }).count(),
    0,
    "undoing away the moving object ends the move",
  );
  await page.keyboard.press("Delete");
  assert.notEqual(
    await page.locator(".status-message").textContent(),
    "Removed. Undo will bring it back.",
    "nothing is selected once undo takes the object away",
  );
  await page.keyboard.press("Control+Shift+z");
  assert.equal((await saved()).objects.length, 1, "redo placing the frog");
  await page.keyboard.press("Escape");
  await clickWorld(frog.x, 0.95, frog.z);
  await page.getByRole("button", { name: "Watch up close" }).click();
  await page.getByRole("complementary", { name: "Watching" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "View", exact: true })
      .getAttribute("aria-pressed"),
    "true",
    "following enters View directly",
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("complementary", { name: "Watching" })
    .waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Worlds" })
    .locator(".preset-options")
    .getByRole("button", { name: "Cloud forest", exact: true })
    .click();
  world = await saved();
  assert.equal(world.name, "Cloud forest");
  assert.ok(world.objects.length > 20);
  await page.reload();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.locator(".asset-picture img").first().waitFor({ timeout: 90000 });
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
  await life.getByRole("button", { name: /Follow a creature/ }).waitFor();
  assert.equal(
    await life
      .getByRole("button", { name: "Scatter insects", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await life
      .getByRole("button", { name: "Mist habitat", exact: true })
      .count(),
    0,
  );
  // Every walking animal is listed to watch; fish are counted by species.
  const lifeWorld = await saved();
  assert.equal(
    await life.locator(".frog-list:not(.fish-list) button").count(),
    lifeWorld.objects.filter((object) =>
      [
        "tree-frog",
        "dart-frog",
        "blue-dart-frog",
        "mossy-frog",
        "gecko",
        "leopard-lizard",
        "desert-spiny-lizard",
        "fence-lizard",
        "canyon-tree-frog",
        "snail",
        "turtle",
        "micro-crab",
        "dwarf-crayfish",
        "cherry-shrimp",
      ].includes(object.kind),
    ).length,
  );
  await life.locator(".fish-list li", { hasText: "Convict cichlid" }).waitFor();
  await life.getByRole("button", { name: /Follow a creature/ }).click();
  await page
    .getByRole("complementary", { name: "Watching", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Stop watching", exact: true })
    .click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    });
  });
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Share this world", exact: true })
    .click();
  await page.getByRole("button", { name: "Share file", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
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
  // Wait for actual movement rather than a fixed hold time: a slow software
  // renderer can go longer than that without drawing a frame.
  await page.locator("canvas").click({ position: { x: 340, y: 180 } });
  assert.ok(fiberUrl, "the running scene loaded React Three Fiber");
  const beforeMove = await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    return _roots
      .get(document.querySelector("canvas"))
      .store.getState()
      .camera.position.toArray();
  }, fiberUrl);
  await page.keyboard.down("w");
  try {
    await page.waitForFunction(
      async ({ url, before }) => {
        const { _roots } = await import(url);
        const position = _roots
          .get(document.querySelector("canvas"))
          .store.getState().camera.position;
        return (
          Math.hypot(
            position.x - before[0],
            position.y - before[1],
            position.z - before[2],
          ) > 0.05
        );
      },
      { url: fiberUrl, before: beforeMove },
    );
  } finally {
    await page.keyboard.up("w");
  }
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
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
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Habitat", exact: true })
    .click();
  await page.locator("summary", { hasText: "Fine-tune habitat" }).click();
  const water = page.getByRole("slider", { name: "Water level", exact: true });
  await water.focus();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Water level",
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Tab");
  await page.waitForFunction(
    (before) =>
      JSON.parse(localStorage.getItem("little-worlds:v1"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).environment.water > before,
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
