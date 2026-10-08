/** View stays read-only; advanced editing and slider gestures remain dependable. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5193";
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    root,
    "--host",
    "127.0.0.1",
    "--port",
    "5193",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
const world = {
  version: 1,
  name: "Mechanics check",
  environment: {
    width: 7,
    depth: 4.5,
    height: 2.9,
    substrate: 0.25,
    water: 0,
    light: "day",
    warmth: 0.45,
    brightness: 1,
  },
  objects: [
    {
      id: "frog",
      kind: "tree-frog",
      x: -2,
      z: 1,
      rotation: 0,
      scale: 1,
      seed: 173,
    },
    {
      id: "plant",
      kind: "monstera",
      x: -1,
      z: -1,
      rotation: 0.3,
      scale: 1,
      seed: 173,
    },
    {
      id: "rock",
      kind: "rock",
      // Clear of the monstera's leaves, which would take the click.
      x: -2.7,
      z: -0.6,
      rotation: 0,
      scale: 1,
      seed: 173,
    },
  ],
};
let browser;
try {
  let ready = false;
  for (let retry = 0; retry < 50; retry++) {
    try {
      await fetch(url);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(ready, "mechanics server starts");
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
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  // Playwright's waitForFunction treats an async predicate's Promise as truthy.
  // Await scene queries ourselves so dynamic imports cannot bypass the check.
  async function waitForScene(check, arg) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await page.evaluate(check, arg)) return;
      await page.waitForTimeout(100);
    }
    throw new Error("The scene did not settle within 30 seconds.");
  }
  const errors = [];
  let fiberUrl;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("@react-three_fiber.js"))
      fiberUrl = response.url();
  });
  await page.addInitScript(
    (world) => localStorage.setItem("little-worlds:v2", JSON.stringify(world)),
    world,
  );
  await page.goto(url);
  await page
    .getByRole("dialog", { name: "How to build" })
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.waitForFunction(() => document.querySelector("canvas"));
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "View", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page.getByRole("slider").count(),
    0,
    "a phone visit starts without editing sliders",
  );
  assert.equal(
    await page.getByRole("complementary", { name: "Terrarium tools" }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "About Paludarium", exact: true })
    .click();
  await page.locator("summary", { hasText: "Follow a creature" }).click();
  await page
    .getByRole("dialog", { name: "About Paludarium" })
    .getByRole("button", { name: /Red-eyed tree frog/ })
    .click();
  await page.getByRole("button", { name: "Watch up close" }).click();
  await page.getByRole("complementary", { name: "Watching" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Remove", exact: true }).count(),
    0,
    "watching offers no edit actions",
  );
  assert.equal(
    await page
      .getByRole("meter", { name: /^(Fullness|Hydration|Energy)$/ })
      .count(),
    0,
    "needs start collapsed",
  );
  await page.keyboard.press("Delete");
  await page.keyboard.press("r");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  assert.deepEqual(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ),
    ),
    world,
    "View shortcuts cannot mutate the world",
  );
  await page.screenshot({ path: "/tmp/paludarium-watch-phone.png" });

  assert.ok(fiberUrl);
  console.log("Checking animal follow and foliage visibility");
  // Set a real camera sightline through actual plant triangles, after close-up settles.
  await waitForScene(async (url) => {
    const { _roots } = await import(url);
    const { controls } = _roots
      .get(document.querySelector("canvas"))
      .store.getState();
    return (
      controls &&
      Math.abs(controls.object.position.distanceTo(controls.target) - 2.4) <
        0.05
    );
  }, fiberUrl);
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    const { scene, camera, controls } = _roots
      .get(document.querySelector("canvas"))
      .store.getState();
    let frog, plant;
    scene.traverse((part) => {
      if (part.userData.objectId === "frog") frog = part;
      if (part.userData.objectId === "plant") plant = part;
    });
    const focus = camera.position.clone();
    frog.getWorldPosition(focus);
    focus.addScaledVector(
      camera.position
        .clone()
        .setFromMatrixColumn(frog.matrixWorld, 1)
        .normalize(),
      0.1,
    );
    const mesh = plant.getObjectByProperty("isMesh", true);
    const positions = mesh.geometry.getAttribute("position");
    const point = camera.position.clone().set(0, 0, 0);
    for (let i = 0; i < 3; i++)
      point.add(camera.position.clone().fromBufferAttribute(positions, i));
    point.divideScalar(3).applyMatrix4(mesh.matrixWorld);
    camera.position.copy(point.sub(focus).multiplyScalar(3).add(focus));
    controls.target.copy(focus);
    controls.update();
  }, fiberUrl);
  await waitForScene(async (url) => {
    const { _roots } = await import(url);
    const { scene } = _roots
      .get(document.querySelector("canvas"))
      .store.getState();
    let faded = false;
    scene.traverse((part) => {
      if (
        part.isMesh &&
        part.material.opacity < 0.2 &&
        part.material.opacity > 0
      )
        faded = true;
    });
    return faded;
  }, fiberUrl);
  await page.screenshot({ path: "/tmp/paludarium-watch-foliage.png" });
  await page
    .getByRole("button", { name: "Stop watching", exact: true })
    .click();
  await waitForScene(async (url) => {
    const { _roots } = await import(url);
    let restored = true;
    _roots
      .get(document.querySelector("canvas"))
      .store.getState()
      .scene.traverse((part) => {
        if (part.userData.plant)
          part.traverse((mesh) => {
            if (mesh.isMesh && mesh.material.opacity !== 1) restored = false;
          });
      });
    return restored;
  }, fiberUrl);

  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page
    .getByRole("button", { name: "Deselect object", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Habitat", exact: true })
    .click();
  assert.equal(
    await page.getByRole("slider").count(),
    1,
    "habitat opens with water level and the fine-tuning sliders collapsed",
  );
  assert.equal(
    await page
      .getByRole("slider", { name: "Water level", exact: true })
      .count(),
    1,
  );
  await page.locator("summary", { hasText: "Fine-tune habitat" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Stone", exact: true }).count(),
    0,
    "backdrop choices are removed from habitat settings",
  );
  assert.equal(
    await page.getByRole("button", { name: "Cork bark", exact: true }).count(),
    0,
  );
  const brightness = page.getByRole("slider", {
    name: "Light brightness",
    exact: true,
  });
  await brightness.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Tab");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).environment.brightness === 1.05,
  );
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).environment.brightness === 1,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
      .isEnabled(),
    false,
    "keyboard change plus blur is exactly one undo step",
  );
  assert.equal(
    await brightness.inputValue(),
    "1",
    "Undo restores the visible brightness, not just the saved value",
  );
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.waitForTimeout(2000);

  async function clickObject(id) {
    const point = await page.evaluate(
      async ({ url, id }) => {
        const { _roots } = await import(url);
        const { scene, camera } = _roots
          .get(document.querySelector("canvas"))
          .store.getState();
        let object;
        scene.traverse((part) => {
          if (part.userData.objectId === id) object = part;
        });
        const position = camera.position.clone();
        object.getWorldPosition(position);
        position.y += id === "plant" ? 0.8 : 0.12;
        position.project(camera);
        const box = document.querySelector("canvas").getBoundingClientRect();
        return {
          x: box.x + ((position.x + 1) * box.width) / 2,
          y: box.y + ((1 - position.y) * box.height) / 2,
        };
      },
      { url: fiberUrl, id },
    );
    await page.mouse.click(point.x, point.y);
  }
  await clickObject("frog");
  await page
    .getByRole("complementary", { name: "Selected object" })
    .getByRole("heading", { name: "Red-eyed tree frog", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("slider", { name: "Size", exact: true }).count(),
    0,
    "animals have no size slider",
  );
  await page
    .getByRole("button", { name: "Deselect object", exact: true })
    .click();
  await clickObject("rock");
  await page
    .getByRole("complementary", { name: "Selected object" })
    .getByRole("heading", { name: "River stone", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page.getByRole("dialog", { name: "Worlds" }).waitFor();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("r");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  assert.deepEqual(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
          key === "" && value.worlds
            ? value.worlds.find((entry) => entry.id === value.activeId).world
            : value,
        ).objects,
    ),
    world.objects,
    "shortcuts don't edit the world behind an open dialog",
  );
  await page.locator("summary", { hasText: "Adjust size" }).focus();
  await page.keyboard.press("Space");
  assert.equal(
    await page.getByRole("slider", { name: "Size", exact: true }).count(),
    1,
    "Space opens a focused disclosure",
  );
  await page.locator("summary", { hasText: "Adjust size" }).click();
  assert.equal(
    await page.getByRole("slider", { name: "Size", exact: true }).count(),
    0,
    "a second press closes it",
  );
  await page.locator("summary", { hasText: "Adjust size" }).click();
  const size = page.getByRole("slider", { name: "Size", exact: true });
  const box = await size.boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, {
    steps: 8,
  });
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
          key === "" && value.worlds
            ? value.worlds.find((entry) => entry.id === value.activeId).world
            : value,
        ).objects.find((o) => o.id === "rock").scale,
    ),
    1,
    "drag is only a preview before release",
  );
  await page.mouse.move(box.x + box.width + 100, box.y - 70);
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).objects.find((o) => o.id === "rock").scale > 1.5,
  );
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).objects.find((o) => o.id === "rock").scale === 1,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
      .isEnabled(),
    false,
    "outside release and blur commit only once",
  );
  assert.equal(await size.inputValue(), "1", "Undo resets the size control");
  await waitForScene(async (url) => {
    const { _roots } = await import(url);
    let rock;
    _roots
      .get(document.querySelector("canvas"))
      .store.getState()
      .scene.traverse((part) => {
        if (part.userData.objectId === "rock") rock = part;
      });
    return rock?.scale.x === 1;
  }, fiberUrl);
  await page
    .getByRole("button", { name: "Deselect object", exact: true })
    .click();
  await clickObject("plant");
  await page
    .getByRole("complementary", { name: "Selected object" })
    .getByRole("heading", { name: "Monstera", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("slider", { name: "Size", exact: true }).count(),
    0,
    "plants have no size slider",
  );
  await page.getByRole("button", { name: "View", exact: true }).click();
  assert.equal(
    await page.getByRole("complementary", { name: "Selected object" }).count(),
    0,
    "View hides the editing selection",
  );
  await clickObject("frog");
  await page.getByRole("button", { name: "Watch up close" }).click();
  await page.getByRole("complementary", { name: "Watching" }).waitFor();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("complementary", { name: "Selected object" }).waitFor();
  assert.equal(
    await page.getByRole("meter", { name: "Condition", exact: true }).count(),
    1,
  );
  await page.getByRole("button", { name: "View", exact: true }).click();
  assert.equal(await page.getByRole("meter").count(), 0);
  await page.getByRole("button", { name: "Watch up close" }).click();
  await page.getByRole("complementary", { name: "Watching" }).waitFor();
  await page
    .getByRole("button", { name: "Stop watching", exact: true })
    .click();
  console.log("Checking watch return, auto-orbit and manual navigation");
  async function watchFrog() {
    // Life is running here, so the frog can move behind foliage between
    // projecting its position and clicking. Scene picking is covered above;
    // use the stable creature picker to set up the camera-return checks.
    await page
      .getByRole("button", { name: "About Paludarium", exact: true })
      .click();
    await page.locator("summary", { hasText: "Follow a creature" }).click();
    await page
      .getByRole("dialog", { name: "About Paludarium" })
      .getByRole("button", { name: /Red-eyed tree frog/ })
      .click();
    await page.getByRole("button", { name: "Watch up close" }).click();
    await page.getByRole("complementary", { name: "Watching" }).waitFor();
  }

  async function cameraState() {
    return page.evaluate(async (url) => {
      const { _roots } = await import(url);
      const { controls } = _roots
        .get(document.querySelector("canvas"))
        .store.getState();
      return {
        position: controls.object.position.toArray(),
        minDistance: controls.minDistance,
        target: controls.target.toArray(),
        angle: controls.getAzimuthalAngle(),
        autoRotate: controls.autoRotate,
      };
    }, fiberUrl);
  }
  async function waitForCloseUp() {
    await waitForScene(async (url) => {
      const { _roots } = await import(url);
      const { controls } = _roots
        .get(document.querySelector("canvas"))
        .store.getState();
      return (
        controls.minDistance === 1 &&
        controls.object.position.distanceTo(controls.target) < 2.5
      );
    }, fiberUrl);
  }
  async function waitForCameraReturn(autoRotate = false) {
    await waitForScene(
      async ({ url, autoRotate }) => {
        const { _roots } = await import(url);
        const { controls } = _roots
          .get(document.querySelector("canvas"))
          .store.getState();
        return controls.minDistance === 4 && controls.autoRotate === autoRotate;
      },
      { url: fiberUrl, autoRotate },
    );
  }
  await waitForCameraReturn();
  assert.equal(
    (await cameraState()).autoRotate,
    false,
    "paused View stays still",
  );
  await page
    .getByRole("button", { name: "Resume life (Space)", exact: true })
    .click();
  assert.equal(
    (await cameraState()).autoRotate,
    true,
    "View auto-orbits again",
  );
  const home = await cameraState();
  await watchFrog();
  assert.equal(
    (await cameraState()).autoRotate,
    false,
    "following suspends auto-orbit",
  );
  await waitForCloseUp();
  // Clicking empty space ends a watch, just like the reported sequence.
  await page.mouse.click(15, 400);
  await page
    .getByRole("complementary", { name: "Watching" })
    .waitFor({ state: "hidden" });
  await waitForCameraReturn(true);
  const returned = await cameraState();
  assert.equal(
    returned.autoRotate,
    true,
    "leaving a watch restores auto-orbit",
  );
  assert.ok(
    returned.target.every(
      (value, i) => Math.abs(value - home.target[i]) < 0.02,
    ),
    "the camera returns to its original orbit target",
  );
  await waitForScene(
    async ({ url, angle }) => {
      const { _roots } = await import(url);
      const { controls } = _roots
        .get(document.querySelector("canvas"))
        .store.getState();
      return Math.abs(controls.getAzimuthalAngle() - angle) > 0.01;
    },
    { url: fiberUrl, angle: returned.angle },
  );
  assert.ok(
    Math.abs((await cameraState()).angle - returned.angle) > 0.01,
    "automatic circling actually advances after returning",
  );
  await page.keyboard.down("d");
  await waitForScene(
    async ({ url, target }) => {
      const { _roots } = await import(url);
      const { controls } = _roots
        .get(document.querySelector("canvas"))
        .store.getState();
      return controls.target
        .toArray()
        .some((value, i) => Math.abs(value - target[i]) > 0.15);
    },
    { url: fiberUrl, target: returned.target },
  );
  await page.keyboard.up("d");
  const panned = await cameraState();
  assert.ok(
    panned.target.some(
      (value, i) => Math.abs(value - returned.target[i]) > 0.1,
    ),
    "keyboard panning works after leaving a watch",
  );
  await page.waitForTimeout(500);
  assert.ok(
    (await cameraState()).target.every(
      (value, i) => Math.abs(value - panned.target[i]) < 0.02,
    ),
    "the finished return no longer pulls against panning",
  );

  await watchFrog();
  await waitForCloseUp();
  await page.keyboard.press("Escape");
  await page.keyboard.down("d");
  await waitForCameraReturn(true);
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  const interrupted = await cameraState();
  assert.equal(
    interrupted.minDistance,
    4,
    "keyboard navigation releases a returning camera immediately",
  );
  await page.waitForTimeout(500);
  assert.ok(
    (await cameraState()).target.every(
      (value, i) => Math.abs(value - interrupted.target[i]) < 0.02,
    ),
    "interrupting the return leaves the user in control",
  );
  await watchFrog();
  await waitForCloseUp();
  // Hold the short return animation between browser commands so even a
  // slow renderer tests a drag during the return, not after it has finished.
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    _roots
      .get(document.querySelector("canvas"))
      .store.getState()
      .setFrameloop("never");
  }, fiberUrl);
  const beforeDrag = await cameraState();
  await page
    .getByRole("button", { name: "Stop watching", exact: true })
    .click();
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    const state = _roots.get(document.querySelector("canvas")).store.getState();
    for (let frame = 1; frame <= 4; frame++) state.advance(frame / 60);
  }, fiberUrl);
  await waitForScene(
    async ({ url, target, position }) => {
      const { _roots } = await import(url);
      const { controls } = _roots
        .get(document.querySelector("canvas"))
        .store.getState();
      return (
        controls.minDistance === 1 &&
        (controls.target
          .toArray()
          .some((value, i) => Math.abs(value - target[i]) > 0.02) ||
          controls.object.position
            .toArray()
            .some((value, i) => Math.abs(value - position[i]) > 0.02))
      );
    },
    { url: fiberUrl, target: beforeDrag.target, position: beforeDrag.position },
  );
  await page.mouse.move(330, 360);
  await page.mouse.down();
  await page.mouse.move(200, 420, { steps: 5 });
  await page.mouse.up();
  const dragged = await cameraState();
  assert.equal(
    dragged.minDistance,
    4,
    "dragging also releases a returning camera",
  );
  await page.evaluate(async (url) => {
    const { _roots } = await import(url);
    _roots
      .get(document.querySelector("canvas"))
      .store.getState()
      .setFrameloop("always");
  }, fiberUrl);
  await page.waitForTimeout(500);
  assert.ok(
    (await cameraState()).target.every(
      (value, i) => Math.abs(value - dragged.target[i]) < 0.02,
    ),
    "the camera return does not resume after releasing the drag",
  );
  console.log("Checking fish continuity through habitat edits");
  await page.close();
  const fishPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  fishPage.on("pageerror", (error) => errors.push(error.message));
  let fishFiberUrl;
  fishPage.on("response", (response) => {
    if (response.url().includes("@react-three_fiber.js"))
      fishFiberUrl = response.url();
  });
  const fishWorld = {
    ...world,
    name: "Fish continuity",
    environment: { ...world.environment, water: 2.65 },
    objects: [
      {
        id: "shark",
        kind: "rainbow-shark",
        x: 0.8,
        z: 0.7,
        rotation: 0,
        scale: 1,
        seed: 3,
      },
      {
        id: "cory",
        kind: "corydoras",
        x: 1.8,
        z: 0.7,
        rotation: 0,
        scale: 1,
        seed: 3,
      },
      { id: "stone", kind: "rock", x: 0, z: 0, rotation: 0, scale: 1, seed: 3 },
    ],
  };
  await fishPage.addInitScript(
    (world) => localStorage.setItem("little-worlds:v2", JSON.stringify(world)),
    fishWorld,
  );
  await fishPage.goto(url);
  await fishPage
    .getByRole("dialog", { name: "How to build" })
    .getByRole("button", { name: "Close dialog" })
    .click();
  await fishPage.bringToFront();
  await fishPage.getByRole("button", { name: "About Paludarium" }).waitFor();
  assert.ok(fishFiberUrl);
  const fishPositions = () =>
    fishPage.evaluate(async (url) => {
      const { _roots } = await import(url);
      const state = _roots
        .get(document.querySelector("canvas"))
        ?.store.getState();
      const positions = {};
      state?.scene.traverse((part) => {
        if (["shark", "cory"].includes(part.userData.objectId))
          positions[part.userData.objectId] = [
            part.position.x,
            part.position.z,
          ];
      });
      return positions;
    }, fishFiberUrl);
  const deadline = Date.now() + 30000;
  let moved = false;
  while (Date.now() < deadline) {
    const positions = await fishPositions();
    if (
      positions.shark &&
      Math.hypot(positions.shark[0] - 0.8, positions.shark[1] - 0.7) > 0.08
    ) {
      moved = true;
      break;
    }
    await fishPage.waitForTimeout(100);
  }
  assert.ok(moved, "bottom fish actually swim in the rendered habitat");
  await fishPage
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  await fishPage.getByRole("button", { name: "Build", exact: true }).click();
  await fishPage
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Habitat", exact: true })
    .click();
  const beforeLight = await fishPositions();
  assert.ok(beforeLight.shark && beforeLight.cory);
  await fishPage.getByRole("button", { name: "Golden", exact: true }).click();
  await fishPage.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("little-worlds:v2"), (key, value) =>
        key === "" && value.worlds
          ? value.worlds.find((entry) => entry.id === value.activeId).world
          : value,
      ).environment.light === "golden",
  );
  await fishPage.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.deepEqual(
    await fishPositions(),
    beforeLight,
    "a fish-only habitat keeps every live position through an edit",
  );
  await fishPage
    .getByRole("button", { name: "Habitat life", exact: true })
    .click();
  await fishPage
    .locator(".fish-list")
    .getByRole("button", { name: /Rainbow shark/ })
    .click();
  await fishPage.getByRole("button", { name: "Watch up close" }).click();
  await fishPage.getByRole("complementary", { name: "Watching" }).waitFor();
  await fishPage.getByRole("button", { name: "Build", exact: true }).click();
  await fishPage.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.deepEqual(
    await fishPositions(),
    beforeLight,
    "a watched fish stays at its live position when switching to Build",
  );
  await fishPage.close();
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(
    "PASS: mobile View, read-only shortcuts, frog taps, foliage fade/restore, hidden settings, static-only size controls, keyboard and outside-release slider undo, watch return, resumed auto-orbit and panning, fish movement and edit continuity",
  );
} finally {
  await browser?.close();
  server.kill();
}
