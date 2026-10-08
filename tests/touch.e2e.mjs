/** Native mobile placement, two-finger navigation and the bottom placement bar. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, webkit, devices } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5197";
const safari = process.env.TOUCH_BROWSER === "webkit";
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    root,
    "--host",
    "127.0.0.1",
    "--port",
    "5197",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
const world = {
  version: 1,
  name: "Aquarium touch check",
  environment: {
    width: 7,
    depth: 4.5,
    substrate: 0.25,
    water: 2.65,
    light: "day",
    warmth: 0.45,
    brightness: 1,
  },
  objects: [
    { id: "stone", kind: "rock", x: 0, z: 0, rotation: 0, scale: 1, seed: 173 },
    {
      id: "fern",
      kind: "java-fern",
      x: -1,
      z: -1,
      rotation: 0,
      scale: 1,
      seed: 173,
    },
  ],
};
let browser;
try {
  for (let retry = 0; retry < 50; retry++) {
    try {
      await fetch(url);
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
  const touchSession = safari ? null : await page.context().newCDPSession(page);
  const errors = [];
  let stage = "starting";
  let fiberUrl;
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(`Browser error during ${stage}: ${error.stack}`);
  });
  page.on("response", (response) => {
    if (response.url().includes("@react-three_fiber.js"))
      fiberUrl = response.url();
  });
  await page.addInitScript((world) => {
    localStorage.setItem("little-worlds:v2", JSON.stringify(world));
  }, world);
  await page.goto(url);
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .tap();
  await page.getByRole("button", { name: "Build", exact: true }).tap();
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Add", exact: true })
    .tap();
  await page.getByRole("button", { name: "Rotala", exact: true }).tap();
  await page.waitForTimeout(500);
  assert.ok(fiberUrl);

  async function saved() {
    return page.evaluate(() =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ),
    );
  }
  async function cameraState() {
    return page.evaluate(async (url) => {
      const { _roots } = await import(url);
      const { camera, controls } = _roots
        .get(document.querySelector("canvas"))
        .store.getState();
      return {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        angle: controls.getAzimuthalAngle(),
        polar: controls.getPolarAngle(),
        distance: camera.position.distanceTo(controls.target),
        zoom: controls.enableZoom,
      };
    }, fiberUrl);
  }
  async function spot(x, z) {
    return page.evaluate(
      async ({ url, x, z }) => {
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
          .set(x, groundHeight(x, z, env), z)
          .project(camera);
        const box = canvas.getBoundingClientRect();
        return {
          x: box.x + ((point.x + 1) * box.width) / 2,
          y: box.y + ((1 - point.y) * box.height) / 2,
        };
      },
      { url: fiberUrl, x, z },
    );
  }
  const syntheticTouches = new Map();
  async function pointer(type, point, id = 1, wrongOffsets = false) {
    const touch = { identifier: id, clientX: point.x, clientY: point.y };
    if (type === "pointerup" || type === "pointercancel")
      syntheticTouches.delete(id);
    else syntheticTouches.set(id, touch);
    await page.evaluate(
      async ({ type, point, id, wrongOffsets, url, touches, touch }) => {
        const event = new PointerEvent(type, {
          bubbles: true,
          pointerType: "touch",
          pointerId: id,
          isPrimary: id === 1,
          clientX: point.x,
          clientY: point.y,
          buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
        });
        if (wrongOffsets) {
          Object.defineProperty(event, "offsetX", { value: 0 });
          Object.defineProperty(event, "offsetY", { value: 0 });
        }
        const canvas = document.querySelector("canvas");
        const { _roots } = await import(url);
        const captureTarget = _roots.get(canvas).store.getState()
          .controls.domElement;
        const release = captureTarget.releasePointerCapture;
        // Synthetic pointer ids cannot own native capture; real taps use the
        // browser's unchanged capture behavior.
        if (type === "pointerup" || type === "pointercancel")
          captureTarget.releasePointerCapture = () => {};
        try {
          const target = wrongOffsets ? captureTarget : canvas;
          target.dispatchEvent(event);
          // Match the complete native touch sample that accompanies pointers.
          // WebKit does not permit constructing Touch objects.
          const types = {
            pointerdown: "touchstart",
            pointermove: "touchmove",
            pointerup: "touchend",
            pointercancel: "touchcancel",
          };
          const sample = new Event(types[type], { bubbles: true });
          Object.defineProperties(sample, {
            touches: { value: touches },
            changedTouches: { value: [touch] },
          });
          target.dispatchEvent(sample);
        } finally {
          captureTarget.releasePointerCapture = release;
        }
      },
      {
        type,
        point,
        id,
        wrongOffsets,
        url: fiberUrl,
        touches: [...syntheticTouches.values()],
        touch,
      },
    );
  }
  async function bottomBar() {
    await page.waitForFunction(() => {
      const app = document.querySelector(".app").getBoundingClientRect();
      const canvas = document.querySelector("canvas").getBoundingClientRect();
      return Math.abs(app.height - canvas.height) < 1;
    });
    const bar = await page.locator(".placement-bar").boundingBox();
    const canvas = await page.locator("canvas").boundingBox();
    const gap = canvas.y + canvas.height - bar.y - bar.height;
    assert.ok(
      gap >= 10 && gap <= 16,
      `placement bar hugs the viewport bottom (${gap}px)`,
    );
  }
  await bottomBar();
  let point = await spot(1.5, 0.8);
  stage = "real aquarium tap with container pointer capture";
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    const canvas = document.querySelector("canvas");
    const surface = _roots.get(canvas).store.getState().controls.domElement;
    surface.addEventListener(
      "pointerup",
      (event) => {
        window.touchReleaseTarget =
          event.target === surface ? "container" : "canvas";
      },
      { once: true },
    );
    canvas.addEventListener(
      "pointerdown",
      (event) => {
        surface.setPointerCapture(event.pointerId);
      },
      { once: true },
    );
  }, fiberUrl);
  await page.touchscreen.tap(point.x, point.y);
  // WebKit's tap driver retains the original target; its container routing is
  // exercised explicitly by the next pointer sequence.
  if (!safari)
    assert.equal(
      await page.evaluate(() => window.touchReleaseTarget),
      "container",
      "the real browser retargets the captured release to the scene container",
    );
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).objects.length === 3,
  );
  await page.waitForTimeout(200);
  assert.equal(
    (await saved()).objects.length,
    3,
    "a real browser tap plants once even when the container captures its release",
  );
  assert.equal((await saved()).objects.at(-1).kind, "rotala");
  await bottomBar();

  // The ray must use the screen position, not offsets relative to a retargeted element.
  point = await spot(-1.8, 0.7);
  stage = "retargeted offsets";
  await pointer("pointerdown", point, 1, true);
  await pointer("pointerup", point, 1, true);
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).objects.length === 4,
  );
  const placed = (await saved()).objects.at(-1);
  assert.ok(
    Math.abs(placed.x + 1.8) < 0.1 && Math.abs(placed.z - 0.7) < 0.1,
    "touch placement uses client coordinates even when event offsets are wrong",
  );

  const beforeDrag = await cameraState();
  stage = "drag and cancellation";
  await pointer("pointerdown", point);
  await pointer("pointermove", { x: point.x + 60, y: point.y });
  await pointer("pointermove", point);
  await pointer("pointerup", point);
  assert.equal(
    (await saved()).objects.length,
    4,
    "single-finger drags never plant",
  );
  assert.ok(
    (await cameraState()).position.every(
      (value, index) => Math.abs(value - beforeDrag.position[index]) < 0.001,
    ),
    "single-finger placement drags do not move the camera",
  );
  await pointer("pointerdown", point);
  await pointer("pointercancel", point);
  await pointer("pointerup", point);
  assert.equal(
    (await saved()).objects.length,
    4,
    "a cancelled touch cannot plant on release",
  );

  // WebKit's test driver has no native multi-touch command. Supply the same
  // pointer events and complete touch snapshot the browser produces.
  async function moveTouches(points) {
    await page.evaluate(async (points) => {
      const canvas = document.querySelector("canvas");
      // Deliberately split the fingers across frames, with the outer finger
      // first: a partial sample must not clamp a fake pinch at minimum zoom.
      for (const point of [...points].reverse()) {
        canvas.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            pointerType: "touch",
            pointerId: point.id,
            clientX: point.x,
            clientY: point.y,
            buttons: 1,
          }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      // Safari exposes touch samples but does not allow constructing Touch.
      const event = new Event("touchmove", { bubbles: true });
      Object.defineProperty(event, "touches", {
        value: points.map((point) => ({ clientX: point.x, clientY: point.y })),
      });
      canvas.dispatchEvent(event);
    }, points);
  }

  async function pan(synthetic = false) {
    const before = await cameraState();
    // Start one finger over empty canvas, so the gesture cannot depend on mesh hits.
    const first = { x: 100, y: 180 },
      second = { x: 170, y: 180 };
    if (touchSession && !synthetic)
      await touchSession.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { ...first, id: 1 },
          { ...second, id: 2 },
        ],
      });
    else {
      await pointer("pointerdown", first);
      await pointer("pointerdown", second, 2);
    }
    for (let step = 1; step <= 5; step++) {
      if (touchSession && !synthetic)
        await touchSession.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            { x: first.x + step * 8, y: first.y, id: 1 },
            { x: second.x + step * 8, y: second.y, id: 2 },
          ],
        });
      else
        await moveTouches([
          { x: first.x + step * 8, y: first.y, id: 1 },
          { x: second.x + step * 8, y: second.y, id: 2 },
        ]);
    }
    if (touchSession && !synthetic)
      await touchSession.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    else {
      await pointer("pointerup", { x: first.x + 40, y: first.y });
      await pointer("pointerup", { x: second.x + 40, y: second.y }, 2);
    }
    await page.waitForTimeout(900);
    const after = await cameraState();
    assert.ok(
      after.target.some(
        (value, index) => Math.abs(value - before.target[index]) > 0.2,
      ),
      "two-finger drag pans the orbit target",
    );
    assert.ok(
      Math.abs(after.angle - before.angle) < 0.01 &&
        Math.abs(after.polar - before.polar) < 0.01,
      "two-finger drag does not rotate the view",
    );
    assert.ok(
      Math.abs(after.distance - before.distance) < 0.05,
      "parallel two-finger drag does not zoom",
    );
  }
  stage = "placement pan";
  await pan();
  stage = "pan with pointer moves split across frames";
  await pan(true);
  assert.equal(
    (await saved()).objects.length,
    4,
    "panning during placement never plants",
  );
  const beforePinch = await cameraState();
  stage = "placement pinch";
  const pinchStart = [
    { x: 100, y: 180, id: 1 },
    { x: 170, y: 180, id: 2 },
  ];
  const pinchEnd = [
    { x: 80, y: 180, id: 1 },
    { x: 190, y: 180, id: 2 },
  ];
  if (touchSession) {
    await touchSession.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: pinchStart,
    });
    await touchSession.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: pinchEnd,
    });
    await touchSession.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } else {
    await pointer("pointerdown", pinchStart[0]);
    await pointer("pointerdown", pinchStart[1], 2);
    await moveTouches(pinchEnd);
    await pointer("pointerup", pinchEnd[0]);
    await pointer("pointerup", pinchEnd[1], 2);
  }
  await page.waitForTimeout(500);
  const afterPinch = await cameraState();
  assert.ok(
    afterPinch.distance < beforePinch.distance * 0.85,
    "an intentional pinch still zooms in",
  );
  assert.equal(
    afterPinch.zoom,
    true,
    "ending a touch gesture restores wheel zoom",
  );
  assert.equal((await saved()).objects.length, 4, "pinching cannot add plants");
  point = await spot(1, 1.2);
  stage = "tap after navigation";
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).objects.length === 5,
  );
  assert.equal(
    (await saved()).objects.length,
    5,
    "tap placement still works after a two-finger pan",
  );
  await page.setViewportSize({ width: 390, height: 570 });
  await bottomBar();
  await page.setViewportSize({ width: 390, height: 720 });
  await bottomBar();
  await page.screenshot({
    path: `/tmp/paludarium-touch-${safari ? "webkit" : "chromium"}.png`,
  });
  await page.getByRole("button", { name: "Done", exact: true }).tap();
  stage = "Build pan";
  await pan();
  await page.getByRole("button", { name: "View", exact: true }).tap();
  stage = "View pan";
  await pan();
  assert.equal(
    (await saved()).objects.length,
    5,
    "camera navigation preserves the layout in all modes",
  );
  stage = "frog placement after an interrupted zoom gesture";
  await page.getByRole("button", { name: "Build", exact: true }).tap();
  await page.getByRole("button", { name: "Worlds", exact: true }).tap();
  await page.getByRole("button", { name: "Empty tank", exact: true }).tap();
  await page.getByRole("button", { name: "Build", exact: true }).tap();
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Add", exact: true })
    .tap();
  await page.getByRole("button", { name: "Animals", exact: true }).tap();
  await page
    .getByRole("button", { name: "Red-eyed tree frog", exact: true })
    .tap();
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    const { camera, controls } = _roots
      .get(document.querySelector("canvas"))
      .store.getState();
    camera.position
      .copy(controls.target)
      .add(camera.position.clone().sub(controls.target).setLength(4));
    controls.update();
  }, fiberUrl);
  await page.waitForTimeout(500);
  point = await spot(0, 0);
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).objects.length === 1,
  );
  // iOS may end a browser gesture without delivering its final pointerup.
  await pointer("pointerdown", point, 81);
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForTimeout(350);
  assert.equal(
    (await saved()).objects.length,
    2,
    "a fresh frog tap recovers after a missing pointer release",
  );
  await pointer("pointercancel", point, 81);
  // A complete touchend must commit even if no pointerup reaches the page.
  await pointer("pointerdown", point, 82);
  await page.evaluate((point) => {
    const event = new Event("touchend", { bubbles: true });
    Object.defineProperties(event, {
      touches: { value: [] },
      changedTouches: {
        value: [{ identifier: 82, clientX: point.x, clientY: point.y }],
      },
    });
    document.querySelector("canvas").dispatchEvent(event);
  }, point);
  await page.waitForTimeout(350);
  assert.equal(
    (await saved()).objects.length,
    3,
    "touch release commits a frog without a corresponding pointerup",
  );
  await pointer("pointercancel", point, 82);
  await page.screenshot({
    path: `/tmp/paludarium-frog-${safari ? "webkit" : "chromium"}.png`,
  });
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(
    `PASS (${safari ? "WebKit" : "Chromium"}): aquarium taps, native coordinates, drag/cancel rejection, two-finger pan in placement/Build/View, pinch zoom, tap after navigation, bottom controls after viewport resizing, zoomed frog placement after lost pointer releases`,
  );
} finally {
  await browser?.close();
  server.kill();
}
