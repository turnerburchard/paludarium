import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";

const full = process.argv.includes("--full");
const root = fileURLToPath(new URL("../", import.meta.url));
const url = process.env.HELP_TEST_URL || "http://127.0.0.1:5199";
const helpKey = "paludarium:help-dismissed";
const storageKey = "little-worlds:v2";
const world = {
  version: 1,
  name: "Kept world",
  environment: {
    width: 7,
    depth: 4.5,
    height: 2.9,
    substrate: 0.25,
    water: 0.44,
    light: "day",
    warmth: 0.45,
    brightness: 1,
  },
  objects: [],
};
const library = {
  version: 1,
  activeId: "kept",
  worlds: [{ id: "kept", world }],
};
const server = process.env.HELP_TEST_URL
  ? null
  : spawn(
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
let browser;
try {
  for (let i = 0; i < 50; i++) {
    try {
      assert.equal((await fetch(url)).status, 200);
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
  async function openPage(viewport, seed = false, failure = null) {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width < 760,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      ({ library, storageKey, seed, failure }) => {
        if (seed && !localStorage.getItem(storageKey))
          localStorage.setItem(storageKey, JSON.stringify(library));
        if (failure) {
          Storage.prototype[failure] = () => {
            throw new Error("Storage blocked");
          };
        }
      },
      { library, storageKey, seed, failure },
    );
    return page;
  }
  async function closeHelp(page, method) {
    const dialog = page.getByRole("dialog", { name: "Controls and help" });
    await dialog.waitFor();
    if (method === "escape") await page.keyboard.press("Escape");
    else if (method === "backdrop")
      await page.locator(".modal-backdrop").click({ position: { x: 3, y: 3 } });
    else await dialog.getByRole("button", { name: "Close dialog" }).click();
    await dialog.waitFor({ state: "detached" });
  }
  async function reopen(page) {
    await page.getByRole("button", { name: "About Paludarium" }).click();
    await page.getByRole("button", { name: "Controls and help" }).click();
    assert.equal(await page.getByRole("dialog").count(), 1);
  }
  for (const viewport of [
    { width: 1440, height: 960 },
    { width: 390, height: 844 },
  ]) {
    for (const method of full ? ["close", "escape", "backdrop"] : ["close"]) {
      console.log(`Help: ${viewport.width} ${method}`);
      const page = await openPage(viewport, !full || method !== "close");
      await page.goto(url);
      await page.getByRole("button", { name: "About Paludarium" }).waitFor();
      assert.equal(
        await page.getByRole("dialog", { name: "Controls and help" }).count(),
        1,
        "a fresh visit opens the existing controls help",
      );
      assert.equal(
        await page.getByRole("dialog", { name: "Worlds", exact: true }).count(),
        0,
      );
      assert.match(
        await page.getByRole("dialog").innerText(),
        /Drag with two fingers to move across the tank/,
      );
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), helpKey),
        null,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .getByRole("button", { name: "Close dialog" })
          .evaluate((el) => el === document.activeElement),
        true,
      );
      if (method === "close") {
        await page.screenshot({
          path: `/tmp/paludarium-help-${viewport.width}.png`,
        });
        await page.getByRole("dialog").evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await page.screenshot({
          path: `/tmp/paludarium-help-${viewport.width}-bottom.png`,
        });
      }
      const saved = await page.evaluate(
        (key) => localStorage.getItem(key),
        storageKey,
      );
      await closeHelp(page, method);
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), helpKey),
        "yes",
      );
      await page.reload();
      await page.getByRole("button", { name: "About Paludarium" }).waitFor();
      assert.equal(
        await page.getByRole("dialog").count(),
        0,
        "returning visits stay unobstructed",
      );
      if (!full || method !== "close")
        assert.equal(
          await page.evaluate((key) => localStorage.getItem(key), storageKey),
          saved,
        );
      for (let i = 0; i < 2; i++) {
        await reopen(page);
        await closeHelp(page, method);
      }
      if (!full) {
        await page.getByRole("button", { name: "Build", exact: true }).click();
        assert.equal(await page.locator(".bottom-hud").count(), 0);
        await page.context().close();
        continue;
      }
      if (method !== "escape") {
        await page.context().close();
        continue;
      }
      await page.getByRole("button", { name: "Build", exact: true }).click();
      assert.equal(
        await page.locator(".bottom-hud").count(),
        0,
        "idle hint is gone",
      );
      if (viewport.width < 760)
        await page
          .getByRole("navigation", { name: "Tools" })
          .getByRole("button", { name: "Add", exact: true })
          .click();
      await page.getByRole("button", { name: "Controls and help" }).click();
      await closeHelp(page, "escape");
      if (method === "escape" && viewport.width > 760) {
        await page
          .getByRole("button", { name: "Landscape", exact: true })
          .click();
        await page
          .getByRole("button", { name: "River stone", exact: true })
          .click();
        await page.getByRole("button", { name: "Done", exact: true }).waitFor();
        for (let i = 0; i < 2; i++) {
          await page.getByRole("button", { name: "Controls and help" }).click();
          await closeHelp(page, "escape");
          assert.equal(
            await page
              .getByRole("button", { name: "Done", exact: true })
              .count(),
            1,
            "closing help preserves placement",
          );
        }
        await page.getByRole("button", { name: "Done", exact: true }).click();
        assert.equal(await page.locator(".bottom-hud").count(), 0);
      }
      await page.context().close();
    }
    if (!full) continue;
    for (const failure of ["getItem", "setItem"]) {
      const page = await openPage(viewport, true, failure);
      await page.goto(url);
      await closeHelp(page, "close");
      await reopen(page);
      await closeHelp(page, "escape");
      await page.getByRole("button", { name: "Pause life (Space)" }).click();
      assert.equal(
        await page.getByRole("dialog").count(),
        0,
        "storage failure does not reopen help within the session",
      );
      await page.reload();
      await closeHelp(page, "backdrop");
      await page.context().close();
    }
    const page = await openPage(viewport, true);
    const hash =
      "#world=1." +
      gzipSync(JSON.stringify({ ...world, name: "Shared layout" })).toString(
        "base64url",
      );
    await page.goto(url + "/" + hash);
    await page.getByRole("navigation", { name: "Shared world" }).waitFor();
    assert.equal(
      await page.getByRole("dialog").count(),
      0,
      "shared links take precedence over automatic help",
    );
    await page.getByRole("button", { name: "Build", exact: true }).click();
    await page.getByRole("dialog", { name: "Build a copy" }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
      JSON.stringify(library),
    );
    await reopen(page);
    await closeHelp(page, "close");
    await page.evaluate((key) => localStorage.removeItem(key), helpKey);
    await page.goto(url + "/#world=1.broken");
    await page.getByRole("dialog").waitFor();
    assert.equal(
      await page.getByRole("dialog", { name: "Controls and help" }).count(),
      0,
    );
    assert.match(await page.getByRole("dialog").innerText(), /link/i);
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), helpKey),
      null,
    );
    await reopen(page);
    await closeHelp(page, "close");
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).worlds[0].world.name,
        storageKey,
      ),
      world.name,
    );
    await page.context().close();
  }
  assert.deepEqual(errors, []);
  console.log(
    full
      ? "PASS: first/returning desktop and touch help, all dismissal paths, reopening, placement interruption, storage failures, shared links/errors, saved worlds"
      : "PASS: desktop and touch initial help, dismissal, return, reopening and no idle hint",
  );
} finally {
  await browser?.close();
  server?.kill();
}
