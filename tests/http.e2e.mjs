/** Actual HTTP origins lack crypto.randomUUID; localhost does not expose that bug. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, webkit, devices } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const serverUrl = "http://127.0.0.1:5199";
const origin = "http://paludarium.test";
const safari = process.env.TOUCH_BROWSER === "webkit";
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "5199",
    "--strictPort",
  ],
  { cwd: root, stdio: "ignore" },
);
const empty = {
  version: 1,
  name: "HTTP empty tank",
  environment: {
    width: 7,
    depth: 4.5,
    substrate: 0.25,
    water: 0,
    light: "day",
    warmth: 0.45,
    brightness: 1,
  },
  objects: [],
};
let browser;
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await fetch(serverUrl);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  browser = await (safari ? webkit : chromium).launch(
    safari
      ? {}
      : {
          executablePath: process.env.CHROMIUM_PATH || undefined,
          args: [
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
  );
  const page = await browser.newPage({
    ...devices["iPhone 13"],
    deviceScaleFactor: 1,
  });
  // Software WebGL on CI can take half a minute to compile a new world's shaders.
  page.setDefaultTimeout(90_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Serve the production files on a genuinely untrusted HTTP origin. Loopback
  // origins are considered secure, even when their URLs start with http://.
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${serverUrl}${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
  await page.addInitScript(
    (world) => localStorage.setItem("little-worlds:v3", JSON.stringify(world)),
    empty,
  );
  await page.goto(origin);
  await page
    .getByRole("dialog", { name: "Controls and help" })
    .getByRole("button", { name: "Close dialog" })
    .click();
  assert.deepEqual(
    await page.evaluate(() => ({
      secure: isSecureContext,
      uuid: typeof crypto.randomUUID,
      random: typeof crypto.getRandomValues,
    })),
    { secure: false, uuid: "undefined", random: "function" },
  );
  await page.getByRole("button", { name: "Pause life (Space)" }).tap();
  await page.getByRole("button", { name: "Build", exact: true }).tap();
  for (const name of [
    "Empty tank",
    "Cloud forest",
    "Alpine creek",
    "Desert spring",
    "Limestone grotto",
    "Tropical island",
    "Amazon river",
    "Asian stream",
  ]) {
    await page.getByRole("button", { name: "Worlds", exact: true }).tap();
    const dialog = page.getByRole("dialog", { name: "Worlds" });
    await dialog
      .locator(".preset-options")
      .getByRole("button", { name, exact: true })
      .tap();
    await dialog.waitFor({ state: "detached" });
    await page.waitForFunction((name) => {
      const world = JSON.parse(
        localStorage.getItem("little-worlds:v3"),
        (key, value) =>
          key === "" && value.worlds
            ? value.worlds.find((entry) => entry.id === value.activeId).world
            : value,
      );
      return name === "Empty tank"
        ? world.objects.length === 0 && world.name === "Untitled"
        : world.name === name && world.objects.length > 0;
    }, name);
  }
  // Start from the same saved empty dry tank to verify placement on HTTP too.
  await page.reload();
  await page.getByRole("button", { name: "Build", exact: true }).tap();
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Add", exact: true })
    .tap();
  await page.getByRole("button", { name: "Animals", exact: true }).tap();
  await page
    .getByRole("button", { name: "Red-eyed tree frog", exact: true })
    .tap();
  await page.waitForTimeout(500);
  const box = await page.locator("canvas").boundingBox();
  await page.touchscreen.tap(
    box.x + box.width * 0.5,
    box.y + box.height * 0.55,
  );
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v3"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).objects.length === 1,
  );
  const placed = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v3"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).objects[0],
  );
  assert.equal(placed.kind, "tree-frog");
  assert.ok(placed.id);
  assert.deepEqual(
    errors,
    [],
    "HTTP menu selections and placement have no runtime errors",
  );
  console.log(
    `PASS (${safari ? "WebKit" : "Chromium"}): insecure HTTP origin, all mobile preset buttons, frog placement and persistence without crypto.randomUUID`,
  );
} finally {
  await browser?.close();
  server.kill();
}
