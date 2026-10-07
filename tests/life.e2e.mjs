import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5198";
const storageKey = "little-worlds:v1";
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "5198",
    "--strictPort",
  ],
  { cwd: root, stdio: "ignore" },
);

function habitat(kind, water) {
  const object = (kind, id, x, z) => ({
    id,
    kind,
    x,
    z,
    rotation: 0,
    scale: 1,
    seed: 173,
  });
  return {
    version: 1,
    name: "Life check",
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
      ...[0, 1].map((i) => ({
        ...object(kind, `adult-${i}`, -2 + i * 0.4, 0),
        life: { age: 900, lifespan: 18000, condition: 1, breeding: 1800 },
      })),
      ...[
        [-2.5, -1],
        [-1.5, -1],
        [-2.5, 1],
        [-1.5, 1],
      ].map(([x, z], i) => object("java-fern", `plant-${i}`, x, z)),
    ],
  };
}

let browser;
try {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(url);
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
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(
    ({ world, storageKey }) => {
      if (!localStorage.getItem(storageKey))
        localStorage.setItem(storageKey, JSON.stringify(world));
    },
    { world: habitat("tree-frog", 0.44), storageKey },
  );
  await page.goto(url);
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page
    .getByRole("textbox", { name: "World name" })
    .fill("Growing habitat");
  await page.getByRole("textbox", { name: "World name" }).press("Enter");
  await page
    .getByRole("button", { name: "Resume life (Space)", exact: true })
    .click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).objects.length === 7,
    storageKey,
  );
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  await page.getByRole("button", { name: "Habitat life", exact: true }).click();
  await page
    .getByRole("button", { name: /Red-eyed tree frog · Juvenile/ })
    .click();
  await page.getByText("Juvenile · Growing", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("meter", { name: "Condition", exact: true })
      .getAttribute("value"),
    "1",
  );
  await page.screenshot({ path: "/tmp/paludarium-juvenile-desktop.png" });
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    storageKey,
  );
  await page.waitForTimeout(5500);
  assert.deepEqual(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      storageKey,
    ),
    saved,
    "pause also freezes life cycles",
  );
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).objects.length === 6,
    storageKey,
  );
  assert.equal(
    await page.getByRole("textbox", { name: "World name" }).inputValue(),
    "Life check",
  );
  await page
    .getByRole("button", { name: "Redo (⌘/Ctrl Shift Z)", exact: true })
    .click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).objects.length === 7,
    storageKey,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      storageKey,
    ),
    saved,
    "reload preserves the juvenile and its age",
  );

  // Aquatic animals use the same lifecycle while retaining their separate swim engine.
  await page.close();
  const fishPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  fishPage.on("pageerror", (error) => errors.push(error.message));
  await fishPage.addInitScript(
    ({ world, storageKey }) => {
      if (!localStorage.getItem(storageKey))
        localStorage.setItem(storageKey, JSON.stringify(world));
    },
    { world: habitat("fish", 2.65), storageKey },
  );
  await fishPage.goto(url);
  await fishPage.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).objects.length === 7,
    storageKey,
  );
  await fishPage
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  await fishPage.getByRole("button", { name: "Build", exact: true }).click();
  await fishPage
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Life", exact: true })
    .click();
  await fishPage.getByText("3 inhabitants", { exact: true }).waitFor();
  await fishPage.screenshot({ path: "/tmp/paludarium-life-phone.png" });
  const bornFish = await fishPage.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key)).objects.find((o) =>
        o.id.startsWith("born:"),
      ),
    storageKey,
  );
  assert.equal(bornFish.kind, "fish");
  assert.equal(bornFish.life.age, 0);

  // A watched animal dying must leave neither a rendered ghost nor a stale watch card.
  await fishPage.close();
  const dying = habitat("tree-frog", 0.44);
  dying.objects = dying.objects.filter((o) => o.id !== "adult-1");
  dying.objects[0].life = {
    age: 17999,
    lifespan: 18000,
    condition: 1,
    breeding: 0,
  };
  const deathPage = await browser.newPage();
  deathPage.on("pageerror", (error) => errors.push(error.message));
  await deathPage.addInitScript(
    ({ world, storageKey }) =>
      localStorage.setItem(storageKey, JSON.stringify(world)),
    { world: dying, storageKey },
  );
  await deathPage.goto(url);
  await deathPage.getByRole("button", { name: "About Paludarium" }).click();
  await deathPage.getByText("Follow a creature", { exact: true }).click();
  await deathPage.getByRole("button", { name: /Red-eyed tree frog/ }).click();
  await deathPage
    .getByRole("complementary", { name: "Watching", exact: true })
    .waitFor();
  await deathPage.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).objects.length === 4,
    storageKey,
  );
  assert.equal(
    await deathPage
      .getByRole("complementary", { name: "Watching", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: land and fish births, juvenile watching, pause, save/reload, Undo/Redo, and watched animal death on desktop and phone",
  );
} finally {
  await browser?.close();
  server.kill();
}
