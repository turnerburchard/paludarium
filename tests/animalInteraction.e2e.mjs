import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5200";
const storageKey = "little-worlds:v3";
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    root,
    "--host",
    "127.0.0.1",
    "--port",
    "5200",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
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
  const widths = process.argv.includes("--phone") ? [390] : [1440, 390];
  for (const width of widths) {
    for (const [kind, name, water] of [
      ["tree-frog", "Red-eyed tree frog", 0],
      ["rainbow-shark", "Rainbow shark", 2.6],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 960 },
        hasTouch: width === 390,
      });
      const errors = [];
      let fiberUrl;
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.url().includes("@react-three_fiber.js"))
          fiberUrl = response.url();
      });
      const world = {
        version: 1,
        name: "Animal interaction",
        environment: {
          width: 7,
          depth: 4.5,
          substrate: 0.25,
          water,
          light: "day",
          warmth: 0.45,
          brightness: 1,
        },
        objects: [
          {
            id: "animal",
            kind,
            x: -2,
            z: 0,
            rotation: 0,
            scale: 1,
            seed: 173,
            life: { age: 900, lifespan: 18000, condition: 1, breeding: 0 },
          },
        ],
      };
      await page.addInitScript(
        ({ world, storageKey }) => {
          if (!localStorage.getItem(storageKey))
            localStorage.setItem(storageKey, JSON.stringify(world));
        },
        { world, storageKey },
      );
      await page.goto(url);
      await page
        .getByRole("dialog", { name: "Controls and help" })
        .getByRole("button", { name: "Close dialog" })
        .click();
      await page
        .getByRole("button", { name: "Pause life (Space)", exact: true })
        .click();
      async function openLife() {
        if (width === 390)
          await page
            .getByRole("navigation", { name: "Tools", exact: true })
            .getByRole("button", { name: "Life", exact: true })
            .click();
        else
          await page
            .getByRole("button", { name: "Habitat life", exact: true })
            .click();
      }
      await page.getByRole("button", { name: "About Paludarium" }).click();
      const about = page.getByRole("dialog", { name: "About Paludarium" });
      await about
        .getByRole("button", { name: "Follow a creature", exact: true })
        .click();
      const followed = page.getByRole("complementary", { name: "Watching" });
      await followed.getByRole("heading", { name, exact: true }).waitFor();
      assert.equal(await about.count(), 0);
      assert.equal(
        await page
          .getByRole("complementary", { name: "Selected object" })
          .count(),
        0,
      );
      await followed.getByRole("button", { name: "Stop watching" }).click();
      const card = page.getByRole("complementary", { name: "Selected object" });
      await card.getByRole("heading", { name, exact: true }).waitFor();
      assert.equal(
        await card.locator(".object-about").evaluate((details) => details.open),
        width > 760,
      );
      assert.equal(await card.getByRole("meter").count(), 0);
      assert.equal(await card.locator(".object-actions").count(), 0);
      assert.equal(
        await page.getByRole("complementary", { name: "Watching" }).count(),
        0,
      );
      await page.screenshot({
        path: `/tmp/paludarium-animal-${kind}-${width}-info.png`,
      });
      await card.getByRole("button", { name: "Watch up close" }).click();
      const watch = page.getByRole("complementary", { name: "Watching" });
      await watch.waitFor();
      assert.equal(await watch.getByRole("meter").count(), 0);
      assert.equal(await watch.locator(".eyebrow, details").count(), 0);
      assert.equal(
        await watch.getByText("Not a shark at all", { exact: false }).count(),
        0,
      );
      await page.screenshot({
        path: `/tmp/paludarium-animal-${kind}-${width}-watch.png`,
      });
      await watch.getByRole("button", { name: "Stop watching" }).click();
      await card.waitFor();
      await page.getByRole("button", { name: "Build", exact: true }).click();
      await card
        .getByRole("meter", { name: "Condition", exact: true })
        .waitFor();
      for (const action of ["Move", "Turn", "Copy", "Kill"])
        await card.getByRole("button", { name: action, exact: true }).waitFor();
      assert.equal(
        await card.getByRole("button", { name: "Remove", exact: true }).count(),
        0,
      );
      await page.screenshot({
        path: `/tmp/paludarium-animal-${kind}-${width}-build.png`,
      });
      assert.ok(fiberUrl);
      async function sceneState() {
        return page.evaluate(async (fiberUrl) => {
          const { _roots } = await import(fiberUrl);
          const { scene } = _roots
            .get(document.querySelector("canvas"))
            .store.getState();
          const bodies = [];
          const animals = [];
          scene.traverse((part) => {
            if (part.userData.remainsId)
              bodies.push({
                id: part.userData.remainsId,
                roll: part.rotation.z,
                y: part.position.y,
              });
            if (part.userData.objectId === "animal")
              animals.push(part.userData.objectId);
          });
          return { bodies, animals };
        }, fiberUrl);
      }
      async function saved() {
        return page.evaluate((key) => {
          const library = JSON.parse(localStorage.getItem(key));
          return library.worlds
            ? library.worlds.find((entry) => entry.id === library.activeId)
                .world
            : library;
        }, storageKey);
      }
      async function waitFor(check) {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          if (await check()) return;
          await page.waitForTimeout(100);
        }
        throw new Error("Animal interaction did not settle");
      }
      await card.getByRole("button", { name: "Kill", exact: true }).click();
      await waitFor(async () => (await saved()).objects.length === 0);
      const death = await saved();
      assert.equal(death.log.length, 1);
      assert.deepEqual(
        { ...death.log[0], at: 0 },
        { at: 0, event: "died", kind, cause: "killed" },
      );
      assert.equal(await card.count(), 0);
      await waitFor(async () => (await sceneState()).bodies.length === 1);
      assert.deepEqual((await sceneState()).animals, []);
      const pausedBody = (await sceneState()).bodies[0];
      await page.waitForTimeout(300);
      assert.deepEqual(
        (await sceneState()).bodies[0],
        pausedBody,
        "pause freezes the death sequence",
      );
      await page
        .getByRole("button", { name: /^Resume life(?: \(Space\))?$/ })
        .click();
      await waitFor(async () => (await sceneState()).bodies[0]?.roll > 0.1);
      await page
        .getByRole("button", { name: /^Pause life(?: \(Space\))?$/ })
        .click();
      await page.screenshot({
        path: `/tmp/paludarium-animal-${kind}-${width}-death.png`,
      });
      await page
        .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
        .click();
      await waitFor(async () => (await saved()).objects.length === 1);
      await waitFor(
        async () =>
          (await sceneState()).bodies.length === 0 &&
          (await sceneState()).animals.length === 1,
      );
      assert.equal((await saved()).log?.length ?? 0, 0);
      if (width === 390) await page.keyboard.press("Control+Shift+z");
      else
        await page
          .getByRole("button", { name: "Redo (⌘/Ctrl Shift Z)", exact: true })
          .click();
      await waitFor(async () => (await saved()).objects.length === 0);
      await waitFor(async () => (await sceneState()).bodies.length === 1);
      assert.equal((await saved()).log.length, 1);
      await openLife();
      await page.getByRole("button", { name: "Life log", exact: true }).click();
      await page
        .getByRole("list", { name: "Life log", exact: true })
        .getByText(`${name} was killed.`)
        .waitFor();
      await page.reload();
      await page.getByRole("button", { name: "About Paludarium" }).waitFor();
      assert.equal((await saved()).objects.length, 0);
      assert.equal((await saved()).log.length, 1);
      assert.deepEqual(errors, []);
      console.log(
        `PASS: ${name}, ${width}px: direct follow, inspection, calm close-up, Build condition, death animation, last-animal remains, pause, Undo/Redo and saved log`,
      );
      await page.close();
    }
  }
} finally {
  await browser?.close();
  server.kill();
}
