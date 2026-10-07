/** Routine CI checks the actual production bundle. Longer gesture regressions
 * remain in test:e2e:full rather than holding up every deployment. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5197";
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
    "5197",
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
  for (const viewport of [
    { width: 1440, height: 960 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      ({ storageKey, original }) => {
        Object.defineProperty(navigator, "canShare", {
          configurable: true,
          value: () => false,
        });
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        });
        if (!localStorage.getItem(storageKey))
          localStorage.setItem(storageKey, JSON.stringify(original));
      },
      {
        storageKey,
        original:
          viewport.width > 760 ? original : { ...original, name: "My creek" },
      },
    );
    await page.goto(url);
    await page.getByRole("button", { name: "Pause life (Space)" }).click();
    const size = viewport.width > 760 ? "desktop" : "phone";
    await page.screenshot({ path: `/tmp/paludarium-worlds-${size}-view.png` });
    await page.getByRole("button", { name: "Build", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: /Export|Import|New world/ })
        .count(),
      0,
    );
    if (viewport.width > 760)
      await page
        .getByRole("textbox", { name: "World name", includeHidden: true })
        .fill("My creek");
    // Clicking the picker blurs rename and must flush the pending autosave before switching.
    await page.getByRole("button", { name: "My worlds", exact: true }).click();
    await page.getByRole("button", { name: "New world", exact: true }).click();
    await page.getByRole("button", { name: "Aquarium", exact: true }).click();
    await page.getByRole("button", { name: "My worlds", exact: true }).click();
    await page
      .getByRole("button", { name: "My creek Open world", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("textbox", { name: "World name", includeHidden: true })
        .inputValue(),
      "My creek",
    );
    assert.equal(
      await page.getByRole("button", { name: /Undo/ }).isDisabled(),
      true,
    );
    await page.reload();
    await page.getByRole("button", { name: "Pause life (Space)" }).click();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    assert.equal(
      await page
        .getByRole("textbox", { name: "World name", includeHidden: true })
        .inputValue(),
      "My creek",
    );
    await page.screenshot({ path: `/tmp/paludarium-worlds-${size}-build.png` });
    await page.getByRole("button", { name: "My worlds", exact: true }).click();
    await page.screenshot({
      path: `/tmp/paludarium-worlds-${size}-picker.png`,
    });
    await page
      .getByRole("button", { name: "Options for My creek", exact: true })
      .click();
    await page.screenshot({
      path: `/tmp/paludarium-worlds-${size}-actions.png`,
    });
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export file", exact: true })
      .click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "my-creek.json");
    await page
      .getByRole("button", { name: "Import file", exact: true })
      .click();
    await page.locator("input[type=file]").setInputFiles({
      name: "creek.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ ...original, name: "Imported creek" }),
      ),
    });
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key)).worlds.length === 3,
      storageKey,
    );
    await page.getByRole("button", { name: "My worlds", exact: true }).click();
    // A failed write must keep the current world and all saved entries intact.
    const before = await page.evaluate(
      (key) => localStorage.getItem(key),
      storageKey,
    );
    await page.evaluate(() => {
      window.originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error("Quota exceeded");
      };
    });
    await page
      .getByRole("button", { name: "Aquarium Open world", exact: true })
      .click();
    assert.equal(
      await page.getByRole("dialog", { name: "My worlds" }).count(),
      1,
    );
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
      before,
    );
    await page.evaluate(() => {
      Storage.prototype.setItem = window.originalSetItem;
    });
    await page
      .getByRole("button", { name: "Options for Imported creek", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete world", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).worlds.length,
        storageKey,
      ),
      3,
    );
    await page
      .getByRole("button", { name: "Confirm delete", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).worlds.length,
        storageKey,
      ),
      2,
    );
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.getByRole("button", { name: "View", exact: true }).click();
    await page
      .getByRole("button", { name: "Share this world", exact: true })
      .click();
    await page.screenshot({ path: `/tmp/paludarium-worlds-${size}-share.png` });
    const filePromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Share file", exact: true }).click();
    assert.equal((await filePromise).suggestedFilename(), "my-creek.json");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data) => {
          window.sharedFile = {
            name: data.files[0].name,
            activation: navigator.userActivation.isActive,
          };
        },
      });
    });
    await page.getByRole("button", { name: "Share file", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.sharedFile), {
      name: "my-creek.json",
      activation: true,
    });
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop and phone save migration, preset switching, immediate save, reload, scoped Undo, export/import, confirmed deletion, storage failure, file sharing, and minimal closed UI",
  );
} finally {
  await browser?.close();
  server.kill();
}
