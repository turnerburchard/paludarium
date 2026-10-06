/** Renders each preset at desktop and phone sizes so changes can be looked at.
 * Usage: npm run screenshot [-- output-dir]   (default: screenshots/)
 */
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = process.argv[2] ?? `${root}screenshots`;
const port = 5192;
const presets = [
  { name: "cloud-forest", button: /Cloud forest.*Monstera/ },
  { name: "alpine-creek", button: /Alpine creek.*strawberries/ },
];
const viewports = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "phone", width: 390, height: 844 },
];

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
    page.on("pageerror", (error) => console.error(error.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await page
      .getByRole("button", { name: "Pause life (Space)", exact: true })
      .click();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    // Thumbnails finish after the scene has started drawing.
    await page
      .locator(".asset-picture img")
      .first()
      .waitFor({ state: "attached", timeout: 90000 });
    for (const preset of presets) {
      await page
        .getByRole("button", { name: "New world", exact: true })
        .click();
      await page.getByRole("button", { name: preset.button }).click();
      await page.waitForTimeout(1500);
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
