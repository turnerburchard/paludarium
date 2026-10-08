/** Renders each preset at desktop and phone sizes so changes can be looked at.
 * Usage: npm run screenshot [-- output-dir]   (default: screenshots/)
 * SCREENSHOT_PRESET and SCREENSHOT_VIEWPORT select a single scene or size.
 */
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = process.argv[2] ?? `${root}screenshots`;
const port = 5192;
const presets = [
  { name: "cloud-forest", button: "Cloud forest" },
  { name: "alpine-creek", button: "Alpine creek" },
  { name: "desert-spring", button: "Desert spring" },
  { name: "limestone-grotto", button: "Limestone grotto" },
  { name: "aquarium", button: "Aquarium" },
].filter(
  (preset) =>
    !process.env.SCREENSHOT_PRESET ||
    preset.name === process.env.SCREENSHOT_PRESET,
);
const viewports = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "phone", width: 390, height: 844 },
].filter(
  (viewport) =>
    !process.env.SCREENSHOT_VIEWPORT ||
    viewport.name === process.env.SCREENSHOT_VIEWPORT,
);

mkdirSync(outDir, { recursive: true });
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    root,
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
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
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(90000);
    page.on("pageerror", (error) => console.error(error.message));
    // Start with an empty tank so opening the menus does not wait on a full habitat.
    await page.addInitScript(() => {
      localStorage.setItem(
        "little-worlds:v2",
        JSON.stringify({
          version: 1,
          name: "Screenshot",
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
        }),
      );
    });
    await page.goto(`http://127.0.0.1:${port}`);
    await page
      .getByRole("dialog", { name: "Controls and help" })
      .getByRole("button", { name: "Close dialog" })
      .click();
    await page
      .getByRole("button", { name: "Pause life (Space)", exact: true })
      .click();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    if (viewport.name === "phone")
      await page
        .getByRole("navigation", { name: "Tools" })
        .getByRole("button", { name: "Add", exact: true })
        .click();
    // Thumbnails finish after the scene has started drawing.
    await page
      .locator(".asset-picture img")
      .first()
      .waitFor({ state: "attached", timeout: 90000 });
    for (const preset of presets) {
      await page.getByRole("button", { name: "Worlds", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Worlds" })
        .locator(".preset-options")
        .getByRole("button", { name: preset.button, exact: true })
        .click();
      await page.waitForTimeout(1500);
      await page
        .locator(".asset-picture img")
        .first()
        .waitFor({ state: "attached" });
      const path = `${outDir}/${preset.name}-${viewport.name}.png`;
      await page.screenshot({ path });
      console.log(path);
      await page.getByRole("button", { name: "View", exact: true }).click();
      await page.waitForTimeout(700);
      const viewPath = `${outDir}/${preset.name}-${viewport.name}-view.png`;
      await page.screenshot({ path: viewPath });
      console.log(viewPath);
      await page.getByRole("button", { name: "Build", exact: true }).click();
      if (viewport.name === "phone") {
        await page
          .getByRole("navigation", { name: "Tools" })
          .getByRole("button", { name: "Life", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            document.querySelector(".sidebar").getBoundingClientRect().bottom <=
            innerHeight + 1,
        );
      } else {
        await page
          .getByRole("button", { name: "Habitat life", exact: true })
          .click();
      }
      const lifePath = `${outDir}/${preset.name}-${viewport.name}-life.png`;
      await page.screenshot({ path: lifePath });
      console.log(lifePath);
      await page
        .getByRole("button", { name: "Add to your world", exact: true })
        .click();
      if (viewport.name === "phone")
        await page
          .getByRole("button", { name: "Close panel", exact: true })
          .click();
    }
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
