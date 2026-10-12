/** View stays read-only; advanced editing and slider gestures remain dependable. */
import assert from "node:assert/strict";
import { startServer } from "../scripts/server.mjs";
import {
  launchChromium,
  savedWorld,
  STEP_TIMEOUT,
  storageKey,
  waitForSave,
  waitForTank,
} from "./browser.mjs";

const server = await startServer();
const world = {
  version: 2,
  name: "Mechanics check",
  environment: {
    width: 7,
    depth: 4.5,
    height: 2.9,
    substrate: 0.25,
    water: 0,
    springs: [],
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
      id: "rock",
      kind: "rock",
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
  browser = await launchChromium();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  page.setDefaultTimeout(STEP_TIMEOUT);
  // Playwright's waitForFunction treats an async predicate's Promise as truthy,
  // so scene queries, which import the renderer, are polled here instead.
  async function waitForScene(check) {
    const deadline = Date.now() + STEP_TIMEOUT;
    while (!(await page.evaluate(check, fiberUrl))) {
      if (Date.now() > deadline) throw new Error("The scene did not settle.");
      await page.waitForTimeout(100);
    }
  }
  const errors = [];
  let fiberUrl;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("@react-three_fiber.js"))
      fiberUrl = response.url();
  });
  await page.addInitScript(
    ({ world, storageKey }) =>
      localStorage.setItem(storageKey, JSON.stringify(world)),
    { world, storageKey },
  );
  await page.goto(server.url);
  await waitForTank(page);
  // Phones have no Pause button, so use the Space shortcut.
  await page.locator("body").press("Space");
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Build", exact: true })
    .waitFor();
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
  await page
    .getByRole("dialog", { name: "About Paludarium" })
    .getByRole("button", { name: "Follow a creature", exact: true })
    .click();
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
  await page.keyboard.press("e");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  assert.deepEqual(
    await savedWorld(page),
    world,
    "View shortcuts cannot mutate the world",
  );
  await page
    .getByRole("button", { name: "Stop watching", exact: true })
    .click();

  // The dock waits for the followed animal to be let go.
  await page
    .getByRole("button", { name: "Deselect object", exact: true })
    .click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Habitat", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("slider", { name: "Water level", exact: true })
      .count(),
    1,
  );
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
    name: "Brightness",
    exact: true,
  });
  await brightness.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Tab");
  await waitForSave(
    page,
    (world) => world.environment.brightness === 1.05,
    "The brighter light was not saved",
  );
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  await waitForSave(
    page,
    (world) => world.environment.brightness === 1,
    "Undo did not restore the light",
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
  // Clicks below project through the camera, so wait for it to take the new
  // size and for the desktop tools' view offset to finish easing, when it
  // snaps to whole pixels.
  await waitForScene(async (url) => {
    const canvas = document.querySelector("canvas");
    const { _roots } = await import(url);
    const { size, camera } = _roots.get(canvas).store.getState();
    return (
      // The canvas is sized from its container a few frames after it resizes.
      size.width === canvas.parentElement.clientWidth &&
      camera.view?.fullWidth === size.width &&
      Number.isInteger(camera.view.offsetX) &&
      Number.isInteger(camera.view.offsetY)
    );
  });

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
        position.y += 0.12;
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
  await page.keyboard.press("e");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  assert.deepEqual(
    (await savedWorld(page)).objects,
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
    (await savedWorld(page)).objects.find((o) => o.id === "rock").scale,
    1,
    "drag is only a preview before release",
  );
  await page.mouse.move(box.x + box.width + 100, box.y - 70);
  await page.mouse.up();
  await waitForSave(
    page,
    (world) => world.objects.find((o) => o.id === "rock").scale > 1.5,
    "The larger rock was not saved",
  );
  await page
    .getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true })
    .click();
  await waitForSave(
    page,
    (world) => world.objects.find((o) => o.id === "rock").scale === 1,
    "Undo did not restore the rock",
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
  });
  await page
    .getByRole("button", { name: "Deselect object", exact: true })
    .click();
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
  await page.close();
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(
    "PASS: mobile View, read-only shortcuts, frog taps, hidden settings, static-only size controls, keyboard and outside-release slider undo",
  );
} finally {
  await browser?.close();
  await server.stop();
}
