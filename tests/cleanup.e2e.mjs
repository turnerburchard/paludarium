/** Sharing works without an account; editing preserves the viewer's context. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5194";
const projectUrl = "https://turnerburchard.com/paludarium/";
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    root,
    "--host",
    "127.0.0.1",
    "--port",
    "5194",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
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
  // Preview crawlers can read the title, description and image without running JS.
  const crawler = await browser.newPage({ javaScriptEnabled: false });
  await crawler.goto(url);
  assert.equal(
    await crawler.locator('meta[property="og:url"]').getAttribute("content"),
    projectUrl,
  );
  assert.equal(
    await crawler.locator('meta[name="twitter:card"]').getAttribute("content"),
    "summary_large_image",
  );
  const imageUrl = await crawler
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  assert.equal(imageUrl, `${projectUrl}share.jpg`);
  assert.ok(
    (
      await crawler
        .locator('meta[property="og:description"]')
        .getAttribute("content")
    ).includes("Build a planted terrarium"),
  );
  await crawler.getByRole("heading", { name: /Paludarium/ }).waitFor();
  await crawler.close();

  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    hasTouch: true,
  });
  const errors = [];
  let fiberUrl;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("@react-three_fiber.js"))
      fiberUrl = response.url();
  });
  await page.addInitScript(() => {
    // Keep gesture and UI checks independent of a dense starter habitat's GPU cost.
    localStorage.setItem(
      "little-worlds:v1",
      JSON.stringify({
        version: 1,
        name: "Cleanup check",
        environment: {
          width: 7,
          depth: 4.5,
          substrate: 0.25,
          water: 0,
          light: "day",
          warmth: 0.45,
          brightness: 1,
        },
        objects: [
          {
            id: "rock",
            kind: "rock",
            x: 0,
            z: 0,
            rotation: 0,
            scale: 1,
            seed: 173,
          },
        ],
      }),
    );
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.copiedLink = value;
        },
      },
    });
  });
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector("canvas"));
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  const preview = await page.evaluate(async () => {
    const image = new Image();
    image.src = "/share.jpg";
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  assert.deepEqual(
    preview,
    [1200, 630],
    "the advertised preview image is served at its declared size",
  );
  await page.getByRole("button", { name: "Share Paludarium" }).click();
  await page.getByText("Link copied", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.copiedLink), projectUrl);
  await page.evaluate(() => {
    window.copiedLink = null;
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data) => {
        window.sharedProject = data;
        if (window.shareError)
          throw new DOMException("Share dismissed", window.shareError);
      },
    });
  });
  await page.getByRole("button", { name: "Share Paludarium" }).click();
  assert.equal(
    (await page.evaluate(() => window.sharedProject)).url,
    projectUrl,
  );
  await page.evaluate(() => {
    window.shareError = "AbortError";
  });
  await page.getByRole("button", { name: "Share Paludarium" }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Project link" }).count(),
    0,
    "canceling native share leaves the scene clean",
  );
  assert.equal(
    await page.evaluate(() => window.copiedLink),
    null,
    "canceling does not copy behind the user's back",
  );
  await page.evaluate(() => {
    window.shareError = "NotAllowedError";
  });
  await page.getByRole("button", { name: "Share Paludarium" }).click();
  const link = page.getByRole("textbox", { name: "Project link" });
  await link.waitFor();
  assert.equal(await link.inputValue(), projectUrl);
  await link.focus();
  assert.equal(
    await link.evaluate((input) => input.selectionEnd - input.selectionStart),
    projectUrl.length,
  );
  await page.getByRole("button", { name: "Close share link" }).click();
  await page.getByRole("button", { name: "What can I do here?" }).click();
  await page.getByRole("dialog", { name: "About Paludarium" }).waitFor();
  await page
    .getByRole("button", { name: "Make it yours", exact: true })
    .click();
  await page.getByRole("textbox", { name: "World name" }).waitFor();
  assert.equal(await page.getByText("TERRARIUM STUDIO").count(), 0);
  const status = page.locator(".save-status");
  const before = await status.boundingBox();
  await page.getByRole("textbox", { name: "World name" }).focus();
  const focused = await status.boundingBox();
  assert.equal(
    focused.y,
    before.y,
    "focusing rename does not move the save status",
  );
  await page
    .getByRole("textbox", { name: "World name" })
    .fill("My quiet forest");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v1")).name ===
      "My quiet forest",
  );
  assert.equal(
    (await status.boundingBox()).y,
    before.y,
    "saving the new name preserves the header layout",
  );

  await page
    .getByRole("button", { name: "Habitat settings", exact: true })
    .click();
  await page.locator("summary", { hasText: "Fine-tune habitat" }).click();
  await page.waitForTimeout(1200);
  assert.ok(fiberUrl);
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    const canvas = document.querySelector("canvas");
    const state = _roots.get(canvas).store.getState();
    window.beforeMode = {
      canvas,
      scene: state.scene,
      camera: state.camera,
      position: state.camera.position.toArray(),
      target: state.controls.target.toArray(),
      width: canvas.width,
      height: canvas.height,
      sidebar: document.querySelector(".sidebar"),
      world: localStorage.getItem("little-worlds:v1"),
    };
    window.modeSamples = [];
    window.sampleModes = true;
    function sample() {
      if (!window.sampleModes) return;
      window.modeSamples.push({
        position: state.camera.position.toArray(),
        width: canvas.width,
        height: canvas.height,
      });
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }, fiberUrl);
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.waitForTimeout(700);
  const preserved = await page.evaluate(async (url) => {
    window.sampleModes = false;
    const { _roots } = await import(url);
    const before = window.beforeMode;
    const canvas = document.querySelector("canvas");
    const state = _roots.get(canvas).store.getState();
    return {
      sameScene: before.scene === state.scene,
      sameCamera: before.camera === state.camera,
      sameCanvas: before.canvas === canvas,
      sameSidebar: before.sidebar === document.querySelector(".sidebar"),
      sameWorld: before.world === localStorage.getItem("little-worlds:v1"),
      noResize: window.modeSamples.every(
        (sample) =>
          sample.width === before.width && sample.height === before.height,
      ),
      noCameraJump: window.modeSamples.every((sample) =>
        sample.position.every(
          (value, i) => Math.abs(value - before.position[i]) < 0.001,
        ),
      ),
      settingsOpen: document.querySelector(
        ".more-options:not(.landscape-options)",
      ).open,
    };
  }, fiberUrl);
  assert.ok(Object.values(preserved).every(Boolean), JSON.stringify(preserved));
  await page.locator("summary", { hasText: "Shape landscape" }).click();
  await page.getByRole("button", { name: "Paint sand", exact: true }).click();
  assert.equal(
    await page.locator(".placement-bar strong").innerText(),
    "Paint sand",
  );
  assert.equal(
    await page.locator(".placement-icon .lucide-paintbrush").count(),
    1,
  );
  assert.equal(await page.locator(".placement-icon .lucide-plus").count(), 0);
  await page.screenshot({ path: "/tmp/paludarium-terrain-cleanup.png" });
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  const phoneCanvas = await page.locator("canvas").boundingBox();
  assert.equal(phoneCanvas.y, 0, "phone Build also keeps a full-height canvas");
  await page.getByRole("button", { name: "View", exact: true }).click();
  assert.deepEqual(await page.locator("canvas").boundingBox(), phoneCanvas);
  await page.getByRole("button", { name: "Build", exact: true }).click();
  assert.deepEqual(
    await page.locator("canvas").boundingBox(),
    phoneCanvas,
    "phone mode switches never resize the canvas",
  );
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page.getByRole("button", { name: "River stone", exact: true }).click();
  const angle = page.getByRole("status", { name: "Placement angle" });
  await page.getByRole("button", { name: "Turn placement right" }).tap();
  assert.equal(await angle.innerText(), "15°", "one touch turns exactly once");
  await page.getByRole("button", { name: "Turn placement left" }).tap();
  assert.equal(await angle.innerText(), "0°");
  const right = await page
    .getByRole("button", { name: "Turn placement right" })
    .boundingBox();
  await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  const held = await angle.innerText();
  assert.ok(parseInt(held) >= 45, "holding spins repeatedly");
  await page.waitForTimeout(250);
  assert.equal(await angle.innerText(), held, "release stops spinning");
  await page.screenshot({ path: "/tmp/paludarium-rotation-phone.png" });
  await page.getByRole("button", { name: "Turn placement left" }).focus();
  await page.keyboard.press("Enter");
  assert.equal(
    parseInt(await angle.innerText()),
    parseInt(held) - 15,
    "keyboard activation turns once",
  );
  await page.keyboard.press("Space");
  assert.equal(parseInt(await angle.innerText()), parseInt(held) - 30);
  assert.equal(
    await page
      .locator('.scene-tools button[aria-label="Resume life (Space)"]')
      .count(),
    1,
    "Space on a turn button does not pause or resume life",
  );
  const placedAngle = parseInt(await angle.innerText());
  const spot = await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    const { groundHeight } = await import("/src/model/terrain.ts");
    const canvas = document.querySelector("canvas");
    const { camera } = _roots.get(canvas).store.getState();
    const env = JSON.parse(
      localStorage.getItem("little-worlds:v1"),
    ).environment;
    const point = camera.position
      .clone()
      .set(2, groundHeight(2, 1, env), 1)
      .project(camera);
    const box = canvas.getBoundingClientRect();
    return {
      x: box.x + ((point.x + 1) * box.width) / 2,
      y: box.y + ((1 - point.y) * box.height) / 2,
    };
  }, fiberUrl);
  await page.mouse.click(spot.x, spot.y);
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v1")).objects.length === 2,
  );
  const rotation = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v1")).objects.at(-1)
        .rotation,
  );
  assert.ok(
    Math.abs(rotation - (placedAngle * Math.PI) / 180) < 0.001,
    "the placed object saves the chosen angle",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.screenshot({ path: "/tmp/paludarium-view-phone.png" });
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(
    "PASS: crawler previews, clipboard/native/canceled sharing, introduction, stable rename and mode transitions, terrain labels and touch/hold/keyboard rotation",
  );
} finally {
  await browser?.close();
  server.kill();
}
