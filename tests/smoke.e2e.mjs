/** Routine CI checks the actual production bundle. Longer gesture regressions
 * remain in test:e2e:full rather than holding up every deployment. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5196";
const storageKey = "little-worlds:v1";
const started = Date.now();
const original = {
  version: 1,
  name: "Smoke check",
  environment: {
    width: 7,
    depth: 4.5,
    substrate: 0.25,
    water: 0.44,
    light: "day",
    warmth: 0.45,
    brightness: 1,
  },
  objects: [],
};
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "5196",
    "--strictPort",
  ],
  { cwd: root, stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(url);
      assert.equal(response.status, 200);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  context.on("page", (page) => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("requestfailed", (request) => errors.push(request.url()));
  });
  await context.addInitScript(
    ({ storageKey, original }) => {
      if (
        location.origin === "http://127.0.0.1:5196" &&
        !localStorage.getItem(storageKey)
      )
        localStorage.setItem(storageKey, JSON.stringify(original));
      Object.defineProperty(navigator, "share", { value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (link) => (window.copiedLink = link) },
      });
    },
    { storageKey, original },
  );
  const page = await context.newPage();
  await page.goto(url);
  await page.getByRole("button", { name: "About Paludarium" }).waitFor();
  assert.equal(await page.getByRole("heading").count(), 0);
  assert.equal(await page.getByRole("slider").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: /Watch a frog|Watch a creature/ })
      .count(),
    0,
  );
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas?.width || !canvas?.height) return false;
    window.originalCanvas = canvas;
    return true;
  });
  const image = await page.evaluate(async () => {
    const image = new Image();
    image.src = document
      .querySelector('meta[property="og:image"]')
      .content.split("/")
      .at(-1);
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  assert.deepEqual(image, [1200, 630]);
  await page.getByRole("button", { name: "Pause life (Space)" }).click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Worlds" })
    .locator(".preset-options")
    .getByRole("button", { name: "Aquarium", exact: true })
    .click();
  await page.waitForFunction((key) => {
    const world = JSON.parse(localStorage.getItem(key), (key, value) =>
      key === "" && value.worlds
        ? value.worlds.find((entry) => entry.id === value.activeId).world
        : value,
    );
    return world?.name === "Aquarium" && world.environment.water > 2;
  }, storageKey);
  const aquarium = await page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ),
    storageKey,
  );
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page.getByRole("button", { name: "Java moss", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "All", exact: true }).count(),
    0,
  );
  const cards = await page.locator(".asset-card").evaluateAll((cards) =>
    cards.slice(0, 6).map((card) => ({
      height: card.getBoundingClientRect().height,
      labelTop:
        card.querySelector(".asset-name").getBoundingClientRect().top -
        card.getBoundingClientRect().top,
    })),
  );
  assert.ok(
    Math.max(...cards.map((card) => card.height)) -
      Math.min(...cards.map((card) => card.height)) <
      1,
  );
  assert.ok(
    Math.max(...cards.map((card) => card.labelTop)) -
      Math.min(...cards.map((card) => card.labelTop)) <
      1,
  );
  const tabColumns = await page
    .locator(".panel-tabs > button")
    .evaluateAll((tabs) =>
      tabs.map((tab) => ({
        left: tab.getBoundingClientRect().left,
        width: tab.getBoundingClientRect().width,
      })),
    );
  const categoryColumns = await page
    .locator(".category-tabs > button")
    .evaluateAll((tabs) =>
      tabs.slice(0, 3).map((tab) => ({
        left: tab.getBoundingClientRect().left,
        width: tab.getBoundingClientRect().width,
      })),
    );
  categoryColumns.forEach((column, index) => {
    assert.ok(Math.abs(column.left - tabColumns[index].left) < 1);
    assert.ok(Math.abs(column.width - tabColumns[index].width) < 1);
  });
  const categoryTop = await page
    .locator(".category-tabs")
    .evaluate((tabs) => tabs.getBoundingClientRect().top);
  await page.locator(".panel-content").evaluate((panel) => {
    panel.scrollTop = 300;
  });
  const scrolledCategoryTop = await page
    .locator(".category-tabs")
    .evaluate((tabs) => tabs.getBoundingClientRect().top);
  assert.ok(Math.abs(scrolledCategoryTop - categoryTop) < 1);
  await page.locator(".panel-content").evaluate((panel) => {
    panel.scrollTop = 0;
  });
  const sheetHeight = await page
    .locator(".sidebar")
    .evaluate((sheet) => sheet.getBoundingClientRect().height);
  await page.getByRole("button", { name: "Animals", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Amazon sword", exact: true })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Plants", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Red-eyed tree frog", exact: true })
      .count(),
    0,
  );
  // Underwater plants stay; land plants are hidden.
  assert.equal(
    await page
      .getByRole("button", { name: "Amazon sword", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page.getByRole("button", { name: "Monstera", exact: true }).count(),
    0,
  );
  assert.ok(
    aquarium.objects.some((object) => object.kind === "cardinal-tetra"),
  );
  assert.ok(
    !aquarium.objects.some((object) => /frog|gecko|turtle/.test(object.kind)),
  );
  await page
    .getByRole("button", { name: "Habitat settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Aquarium", exact: true }).waitFor();
  const habitatHeight = await page
    .locator(".sidebar")
    .evaluate((sheet) => sheet.getBoundingClientRect().height);
  assert.ok(Math.abs(habitatHeight - sheetHeight) < 1);
  const tabs = await page
    .locator(".panel-tabs > button")
    .evaluateAll((tabs) =>
      tabs.map((tab) => tab.getBoundingClientRect().width),
    );
  assert.ok(Math.max(...tabs) - Math.min(...tabs) < 1);
  assert.ok(
    await page
      .getByRole("button", { name: "Close panel" })
      .evaluate(
        (button) => button.getBoundingClientRect().right > innerWidth - 60,
      ),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Aquarium", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Shoreline", exact: true }).click();
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).environment.water > 2,
    storageKey,
  );
  await page.getByRole("button", { name: "View", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () => document.querySelector("canvas") === window.originalCanvas,
    ),
    true,
  );
  assert.equal(await page.locator(".sidebar").isVisible(), false);
  await page.getByRole("button", { name: "Share this world" }).click();
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  await page.getByText("World link copied", { exact: true }).waitFor();
  const hash = new URL(await page.evaluate(() => window.copiedLink)).hash;
  assert.match(hash, /^#world=1\.[A-Za-z0-9_-]+$/);
  await page.evaluate(
    ({ storageKey, original }) =>
      localStorage.setItem(storageKey, JSON.stringify(original)),
    { storageKey, original },
  );
  await page.goto(url + "/" + hash);
  await page.getByRole("navigation", { name: "Shared world" }).waitFor();
  assert.deepEqual(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key), (key, value) =>
          key === "" && value.worlds
            ? value.worlds.find((entry) => entry.id === value.activeId).world
            : value,
        ),
      storageKey,
    ),
    original,
  );
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("dialog", { name: "Build a copy" }).waitFor();
  await page.getByRole("button", { name: "Build a copy", exact: true }).click();
  await page.waitForFunction(
    (key) =>
      !location.hash &&
      JSON.parse(localStorage.getItem(key), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).name === "Aquarium",
    storageKey,
  );
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page.getByRole("button", { name: "Smoke check", exact: true }).click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).worlds.length === 2,
    storageKey,
  );
  assert.deepEqual(
    await page.evaluate((key) => {
      const library = JSON.parse(localStorage.getItem(key));
      return library.worlds.find((entry) => entry.id === library.activeId)
        .world;
    }, storageKey),
    original,
  );
  const unreadable = await browser.newPage();
  await unreadable.addInitScript((key) => {
    // Seed once, so a reload can't hide an overwrite.
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "yes");
    localStorage.setItem(key, '{"version":1,"name":"Broken"');
  }, storageKey);
  await unreadable.goto(url);
  await unreadable.waitForFunction(() => document.querySelector("canvas"));
  await unreadable.waitForTimeout(600);
  assert.equal(
    await unreadable.evaluate((key) => localStorage.getItem(key), storageKey),
    '{"version":1,"name":"Broken"',
    "an unreadable save is not overwritten before the user edits",
  );
  assert.deepEqual(
    errors,
    [],
    "production rendering and interactions have no runtime errors",
  );
  console.log(
    `PASS (${Math.round((Date.now() - started) / 1000)}s): production bundle, minimal mobile View, aquarium, water Undo, persistent scene, preview image, share snapshot, safe adoption and world switching, unreadable save kept`,
  );
} finally {
  await browser?.close();
  server.kill();
}
