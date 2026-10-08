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
  await crawler.getByRole("heading", { name: /paludarium/i }).waitFor();
  await crawler.close();

  const page = await browser.newPage({
    viewport: { width: 960, height: 640 },
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
      "little-worlds:v2",
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
  assert.equal(
    await page.getByRole("heading").count(),
    0,
    "View has no branding headline",
  );
  assert.equal(
    await page
      .getByText("A tiny living world. Yours to shape.", { exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: /Watch a frog|Watch a creature/ })
      .count(),
    0,
  );
  assert.equal(
    await page.getByText("What can I do here?", { exact: true }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "About Paludarium", exact: true })
    .waitFor();
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
  await page.getByRole("button", { name: "Share this world" }).click();
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  await page.getByText("World link copied", { exact: true }).waitFor();
  const sharedLink = await page.evaluate(() => window.copiedLink);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  assert.ok(sharedLink.startsWith(`${projectUrl}#world=1.`));
  const sharedWorld = await page.evaluate(async (link) => {
    const { readWorldLink } = await import("/src/editor/worldLinks.ts");
    return readWorldLink(new URL(link).hash);
  }, sharedLink);
  assert.deepEqual(
    sharedWorld,
    await page.evaluate(() => {
      const library = JSON.parse(
        localStorage.getItem("little-worlds:v2"),
        (key, value) =>
          key === "" && value.worlds
            ? value.worlds.find((entry) => entry.id === value.activeId).world
            : value,
      );
      return library;
    }),
  );
  await page.evaluate(() => {
    window.copiedLink = null;
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data) => {
        window.sharedProject = data;
        window.sharedWithActivation = navigator.userActivation.isActive;
        if (window.shareError)
          throw new DOMException("Share dismissed", window.shareError);
      },
    });
  });
  await page.getByRole("button", { name: "Share this world" }).click();
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => window.sharedProject)).url,
    sharedLink,
  );
  assert.equal(await page.evaluate(() => window.sharedWithActivation), true);
  assert.equal(await page.evaluate(() => window.sharedProject.text), undefined);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => window.sharedProject)).title,
    "Cleanup check · Paludarium",
  );
  await page.evaluate(() => {
    window.shareError = "AbortError";
  });
  await page.getByRole("button", { name: "Share this world" }).click();
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "World link" }).count(),
    0,
    "canceling native share leaves the scene clean",
  );
  assert.equal(
    await page.evaluate(() => window.copiedLink),
    null,
    "canceling does not copy behind the user's back",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.evaluate(() => {
    window.shareError = "NotAllowedError";
  });
  await page.getByRole("button", { name: "Share this world" }).click();
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  const link = page.getByRole("textbox", { name: "World link" });
  await link.waitFor();
  assert.equal(await link.inputValue(), sharedLink);
  await link.focus();
  assert.equal(
    await link.evaluate((input) => input.selectionEnd - input.selectionStart),
    sharedLink.length,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
  });
  await page.getByRole("button", { name: "Share this world" }).click();
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "World link" }).inputValue(),
    sharedLink,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data) => {
        window.sharedProject = data;
      },
    });
  });
  await page.getByRole("button", { name: "About Paludarium" }).click();
  await page.getByRole("dialog", { name: "About Paludarium" }).waitFor();
  await page.getByRole("button", { name: "Close introduction" }).click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
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
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).name === "My quiet forest",
  );
  assert.equal(
    (await status.boundingBox()).y,
    before.y,
    "saving the new name preserves the header layout",
  );

  await page.evaluate(() => {
    window.shareError = null;
  });
  await page.getByRole("button", { name: "Share this world" }).click();
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  const renamedShared = await page.evaluate(async () => {
    const { readWorldLink } = await import("/src/editor/worldLinks.ts");
    return readWorldLink(new URL(window.sharedProject.url).hash);
  });
  assert.equal(renamedShared.name, "My quiet forest");
  assert.notEqual(
    (await page.evaluate(() => window.sharedProject)).url,
    sharedLink,
  );

  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
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
      world: localStorage.getItem("little-worlds:v2"),
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
      sameWorld: before.world === localStorage.getItem("little-worlds:v2"),
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
  // The canvas resizes a frame after the viewport does.
  await page.waitForFunction(
    () => document.querySelector("canvas").getBoundingClientRect().width <= 390,
  );
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
  await page.getByRole("button", { name: "Landscape", exact: true }).click();
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
      localStorage.getItem("little-worlds:v2"),
      (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
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
  const touchSession = await page.context().newCDPSession(page);
  async function touch(type, points) {
    await touchSession.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points,
    });
  }
  async function placementCamera() {
    return page.evaluate(async (url) => {
      const { _roots } = await import(url);
      const { camera, controls } = _roots
        .get(document.querySelector("canvas"))
        .store.getState();
      return {
        position: camera.position.toArray(),
        rotate: controls.enableRotate,
      };
    }, fiberUrl);
  }
  const beforeTouch = await placementCamera();
  assert.equal(beforeTouch.rotate, false, "one-finger placement cannot orbit");
  const finger = { x: spot.x, y: spot.y, id: 0 };
  await touch("touchStart", [finger]);
  await touch("touchMove", [{ ...finger, x: finger.x + 45 }]);
  await touch("touchMove", [finger]);
  await touch("touchEnd", []);
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
          key === "" && value.worlds
            ? value.worlds.find((entry) => entry.id === value.activeId).world
            : value,
        ).objects.length,
    ),
    1,
    "a drag returning to its start does not place anything",
  );
  const afterTouch = await placementCamera();
  // Damping can finish settling by a fraction of a pixel during the gesture.
  assert.ok(
    Math.hypot(
      ...afterTouch.position.map(
        (value, index) => value - beforeTouch.position[index],
      ),
    ) < 0.001,
    "dragging during placement leaves the camera still",
  );
  await touch("touchStart", [finger]);
  await touch("touchCancel", []);
  await page.touchscreen.tap(spot.x, spot.y);
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).objects.length === 2,
  );
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
          key === "" && value.worlds
            ? value.worlds.find((entry) => entry.id === value.activeId).world
            : value,
        ).objects.length,
    ),
    2,
    "a tap after cancellation places exactly once, including its compatibility click",
  );
  const rotation = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).objects.at(-1).rotation,
  );
  assert.ok(
    Math.abs(rotation - (placedAngle * Math.PI) / 180) < 0.001,
    "the placed object saves the chosen angle",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(
    (await placementCamera()).rotate,
    true,
    "Done restores camera navigation",
  );
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.screenshot({ path: "/tmp/paludarium-view-phone.png" });
  await page.close();
  // A shared layout is a preview, not an import over the recipient's work.
  const receiver = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  receiver.on("pageerror", (error) => errors.push(error.message));
  const ownWorld = {
    ...sharedWorld,
    name: "My original habitat",
    objects: [{ ...sharedWorld.objects[0], id: "my-rock", x: -1 }],
  };
  await receiver.addInitScript((world) => {
    if (!sessionStorage.getItem("receiver-initialized")) {
      localStorage.setItem("little-worlds:v2", JSON.stringify(world));
      sessionStorage.setItem("receiver-initialized", "true");
    }
  }, ownWorld);
  const receivedURL = `${url}/${new URL(sharedLink).hash}`;
  await receiver.goto(receivedURL);
  await receiver
    .getByRole("navigation", { name: "Shared world", exact: true })
    .getByText("Cleanup check", { exact: true })
    .waitFor();
  await receiver.waitForTimeout(500);
  const receiverSaved = () =>
    receiver.evaluate(() =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ),
    );
  assert.deepEqual(await receiverSaved(), ownWorld);
  assert.equal(
    await receiver
      .getByRole("textbox", { name: "World name", includeHidden: true })
      .count(),
    0,
  );
  await receiver.getByRole("button", { name: "Build", exact: true }).click();
  await receiver
    .getByRole("dialog", { name: "Build a copy", exact: true })
    .waitFor();
  await receiver.screenshot({ path: "/tmp/paludarium-shared-copy-phone.png" });
  await receiver
    .getByRole("button", { name: "Keep watching", exact: true })
    .click();
  assert.deepEqual(await receiverSaved(), ownWorld);
  await receiver.reload();
  await receiver
    .getByRole("navigation", { name: "Shared world", exact: true })
    .getByText("Cleanup check", { exact: true })
    .waitFor();
  assert.deepEqual(await receiverSaved(), ownWorld);
  await receiver.getByRole("button", { name: "Build", exact: true }).click();
  await receiver
    .getByRole("button", { name: "Keep watching", exact: true })
    .click();
  await receiver
    .getByRole("link", { name: "Back to my world", exact: true })
    .click();
  await receiver
    .getByRole("button", { name: "About Paludarium", exact: true })
    .waitFor();
  await receiver.getByRole("button", { name: "Build", exact: true }).click();
  assert.equal(
    await receiver
      .getByRole("textbox", { name: "World name", includeHidden: true })
      .inputValue(),
    "My original habitat",
  );
  await receiver.goto(receivedURL);
  await receiver
    .getByRole("navigation", { name: "Shared world", exact: true })
    .getByText("Cleanup check", { exact: true })
    .waitFor();
  await receiver.getByRole("button", { name: "Build", exact: true }).click();
  await receiver
    .getByRole("button", { name: "Build a copy", exact: true })
    .click();
  await receiver.locator(".topbar").waitFor();
  assert.deepEqual(await receiverSaved(), sharedWorld);
  assert.equal(new URL(receiver.url()).hash, "");
  await receiver.getByRole("button", { name: "Worlds", exact: true }).click();
  await receiver
    .getByRole("button", {
      name: "My original habitat",
      exact: true,
    })
    .click();
  await receiver.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).name === "My original habitat",
  );
  assert.deepEqual(await receiverSaved(), ownWorld);
  await receiver.goto(`${url}/#world=1.broken`);
  await receiver
    .getByRole("dialog", { name: "Couldn’t open this world", exact: true })
    .waitFor();
  assert.deepEqual(await receiverSaved(), ownWorld);
  await receiver
    .getByRole("button", { name: "Return to my world", exact: true })
    .click();
  assert.equal(new URL(receiver.url()).hash, "");
  await receiver.close();

  const newcomer = await browser.newPage({
    viewport: { width: 960, height: 640 },
  });
  newcomer.on("pageerror", (error) => errors.push(error.message));
  await newcomer.goto(receivedURL);
  await newcomer
    .getByRole("navigation", { name: "Shared world", exact: true })
    .getByText("Cleanup check", { exact: true })
    .waitFor();
  await newcomer.waitForTimeout(500);
  assert.equal(
    await newcomer.evaluate(() => localStorage.getItem("little-worlds:v2")),
    null,
  );
  await newcomer.getByRole("button", { name: "Build", exact: true }).click();
  assert.equal(
    await newcomer
      .getByRole("button", { name: "Export my world", exact: true })
      .count(),
    0,
  );
  await newcomer
    .getByRole("button", { name: "Build a copy", exact: true })
    .click();
  assert.deepEqual(
    await newcomer.evaluate(() =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ),
    ),
    sharedWorld,
  );
  await newcomer.reload();
  await newcomer.getByRole("button", { name: "Build", exact: true }).click();
  assert.equal(
    await newcomer.getByRole("textbox", { name: "World name" }).inputValue(),
    "Cleanup check",
  );
  await newcomer.close();
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(
    "PASS: crawler previews, clipboard/native/canceled sharing, introduction, stable rename and mode transitions, terrain labels and touch/hold/keyboard rotation",
  );
} finally {
  await browser?.close();
  server.kill();
}
