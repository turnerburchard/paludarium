/** Routine CI checks the actual production bundle. Longer gesture regressions
 * remain in test:e2e:full rather than holding up every deployment. */
import assert from "node:assert/strict";
import { startServer } from "../scripts/server.mjs";
import {
  launchChromium,
  savedWorld,
  STEP_TIMEOUT,
  storageKey,
  waitForSave,
  waitForTank,
} from "./browser.mjs";

const started = Date.now();
const original = {
  version: 2,
  name: "Smoke check",
  environment: {
    width: 7,
    depth: 4.5,
    substrate: 0.25,
    water: 0.44,
    springs: [],
    warmth: 0.45,
    brightness: 1,
  },
  objects: [],
};
const server = await startServer({ preview: true });
const { url } = server;
let browser;
try {
  browser = await launchChromium();
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  context.setDefaultTimeout(STEP_TIMEOUT);
  // No share server runs here, so sharing falls back to the full link.
  const toShareServer = (url) => url.endsWith("/api/worlds");
  context.on("page", (page) => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !toShareServer(message.location().url))
        errors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      if (!toShareServer(request.url())) errors.push(request.url());
    });
  });
  await context.addInitScript(
    ({ storageKey, original, url }) => {
      if (location.origin === url && !localStorage.getItem(storageKey))
        localStorage.setItem(storageKey, JSON.stringify(original));
      Object.defineProperty(navigator, "share", { value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (link) => (window.copiedLink = link) },
      });
    },
    { storageKey, original, url },
  );
  const page = await context.newPage();
  await page.goto(url);
  await waitForTank(page);
  assert.deepEqual(await page.getByRole("heading").allTextContents(), [
    "paludarium",
  ]);
  assert.equal(await page.getByRole("slider").count(), 0);
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const controls = await page.evaluate(() => {
      const brand = document.querySelector(".brand").getBoundingClientRect();
      const tools = document
        .querySelector(".header-actions")
        .getBoundingClientRect();
      return {
        brandRight: brand.right,
        toolsLeft: tools.left,
        toolsRight: tools.right,
      };
    });
    assert.ok(controls.brandRight <= controls.toolsLeft);
    assert.ok(controls.toolsRight <= width - 12);
  }
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
  // Phones have no Pause button, so use the Space shortcut.
  await page.locator("body").press("Space");
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Worlds" })
    .locator(".preset-options")
    .getByRole("button", { name: "Amazon river", exact: true })
    .click();
  await waitForTank(page);
  await waitForSave(
    page,
    (world) => world.name === "Amazon river",
    "The Amazon river was not opened",
  );
  const aquarium = await savedWorld(page);
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
  // Measured against the panel because the sheet may still be sliding up.
  const scrolledCategoryOffset = await page
    .locator(".panel-content")
    .evaluate((panel) => {
      panel.scrollTop = 300;
      return (
        panel.querySelector(".category-tabs").getBoundingClientRect().top -
        panel.getBoundingClientRect().top
      );
    });
  assert.ok(Math.abs(scrolledCategoryOffset) < 1);
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
  const water = page.getByRole("slider", { name: "Water level", exact: true });
  await water.waitFor();
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
  await water.focus();
  await water.press("Home");
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  await waitForSave(
    page,
    (world) => world.environment.water > 2,
    "Undo did not restore the water",
  );
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
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
  await waitForTank(page);
  // The link opens like a preset, and leaves the address once it has.
  await page.waitForFunction(() => !location.hash);
  await waitForSave(
    page,
    (world) => world.name === "Amazon river",
    "The shared world was not opened",
  );
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page.getByRole("button", { name: "Smoke check", exact: true }).click();
  await waitForTank(page);
  // Unedited, it goes the way of an unedited preset.
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).worlds.length === 1,
    storageKey,
  );
  assert.deepEqual(await savedWorld(page), {
    ...original,
    environment: { ...original.environment, height: 2.9 },
  });
  assert.deepEqual(
    errors,
    [],
    "production rendering and interactions have no runtime errors",
  );
  console.log(
    `PASS (${Math.round((Date.now() - started) / 1000)}s): production bundle, minimal mobile View, aquarium, water Undo, persistent scene, preview image, share snapshot, opening a shared world and switching away`,
  );
} finally {
  await browser?.close();
  await server.stop();
}
