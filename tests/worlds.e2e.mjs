/** Routine CI checks the actual production bundle. Longer gesture regressions
 * remain in test:e2e:full rather than holding up every deployment. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5197";
const storageKey = "little-worlds:v4";
const started = Date.now();
const original = {
  version: 1,
  name: "Smoke check",
  environment: {
    width: 7,
    depth: 4.5,
    substrate: 0.25,
    water: 0.44,
    springs: [],
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
// A taken port would leave these checks quietly testing another app.
server.on("exit", (code) => {
  if (code && !server.killed)
    throw new Error("Vite exited early. Is its port already in use?");
});
const browsers = [];
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
  const errors = [];
  // Each size gets its own browser, and so its own GPU process, so their
  // shader compiles run side by side instead of one after the other.
  async function checkWorlds(viewport) {
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    });
    browsers.push(browser);
    const page = await browser.newPage({ viewport });
    // Software WebGL on CI can take half a minute to compile a new world's shaders.
    page.setDefaultTimeout(90_000);
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
    await page
      .getByRole("dialog", { name: "Controls and help" })
      .getByRole("button", { name: "Close dialog" })
      .click();
    await page.getByRole("button", { name: "Pause life (Space)" }).click();
    await page.getByRole("button", { name: "Worlds", exact: true }).click();
    assert.equal(await page.locator(".preset-options button").count(), 7);
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: /Redo/, includeHidden: true })
        .isVisible(),
      viewport.width > 760,
    );
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
    await page.getByRole("button", { name: "Worlds", exact: true }).click();
    await page.waitForFunction(
      () => document.title === "paludarium · My creek",
    );
    await page
      .locator(".preset-options")
      .getByRole("button", { name: "Empty tank", exact: true })
      .click();
    await page.waitForFunction(
      () => document.title === "paludarium · Untitled",
    );
    await page.getByRole("button", { name: "Worlds", exact: true }).click();
    await page.getByRole("button", { name: "My creek", exact: true }).click();
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
    if (viewport.width > 760) {
      await page
        .getByRole("button", { name: "Habitat settings", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Daylight", exact: true })
        .waitFor();
      // The rest is the same save logic at either size, and software
      // rendering makes the large desktop canvas slow, so only the phone runs it.
      await page.close();
      return;
    }
    await page.reload();
    await page.getByRole("button", { name: "Pause life (Space)" }).click();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    assert.equal(
      await page
        .getByRole("textbox", { name: "World name", includeHidden: true })
        .inputValue(),
      "My creek",
    );
    await page.getByRole("button", { name: "Worlds", exact: true }).click();
    await page
      .getByRole("button", { name: "Options for My creek", exact: true })
      .click();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export file", exact: true })
      .click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "my-creek.json");
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page.locator("input[type=file]").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("not a world"),
    });
    const importError = page
      .getByRole("dialog", { name: "Worlds" })
      .getByRole("status");
    await importError.waitFor();
    assert.equal(
      await importError.textContent(),
      "This file isn't a Paludarium terrarium.",
    );
    assert.equal(await page.locator(".status-message").count(), 0);
    await page.getByRole("button", { name: "Import", exact: true }).click();
    assert.equal(await importError.count(), 0, "retry clears the import error");
    await page.locator("input[type=file]").setInputFiles({
      name: "creek.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ ...original, name: "Imported creek" }),
      ),
    });
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key)).worlds.length === 2,
      storageKey,
    );
    await page.getByRole("button", { name: "Worlds", exact: true }).click();
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
      .locator(".world-list")
      .getByRole("button", { name: "My creek", exact: true })
      .click();
    assert.equal(await page.getByRole("dialog", { name: "Worlds" }).count(), 1);
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
      2,
    );
    await page
      .getByRole("button", { name: "Confirm delete", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).worlds.length,
        storageKey,
      ),
      1,
    );
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.getByRole("button", { name: "View", exact: true }).click();
    await page
      .getByRole("button", { name: "Share this world", exact: true })
      .click();
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
  await Promise.all(
    [
      { width: 1440, height: 960 },
      { width: 390, height: 844 },
    ].map(checkWorlds),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop and phone rename, preset switching, reload, export/import, confirmed deletion, storage failure, file sharing, and minimal closed UI",
  );
} finally {
  await Promise.all(browsers.map((browser) => browser.close()));
  server.kill();
}
