/** The life panel and log show a habitat's animals and what has happened to
 * them. Ageing, births and deaths are simulation rules, unit tested in
 * lifeCycle.test.ts; waiting for them here would depend on frame rate. */
import assert from "node:assert/strict";
import { startServer } from "../scripts/server.mjs";
import {
  launchChromium,
  STEP_TIMEOUT,
  storageKey,
  waitForTank,
} from "./browser.mjs";

const frog = (id, x, z, life) => ({
  id,
  kind: "tree-frog",
  x,
  z,
  rotation: 0,
  scale: 1,
  seed: 173,
  life: { age: 900, lifespan: 18000, condition: 1, breeding: 0, ...life },
});
const world = {
  version: 2,
  name: "Life check",
  environment: {
    width: 7,
    depth: 4.5,
    substrate: 0.25,
    water: 0.44,
    springs: [],
    warmth: 0.45,
    brightness: 1,
  },
  objects: [
    frog("adult-0", -2, 0),
    frog("adult-1", -1.6, 0),
    {
      ...frog("young", -1.8, 0.4, { age: 30 }),
      parents: ["adult-0", "adult-1"],
    },
    ...[
      [-2.5, -1],
      [-1.5, -1],
      [-2.5, 1],
      [-1.5, 1],
    ].map(([x, z], i) => ({
      id: `plant-${i}`,
      kind: "java-fern",
      x,
      z,
      rotation: 0,
      scale: 1,
      seed: 173,
    })),
  ],
  log: [{ at: 0, event: "died", kind: "tree-frog", cause: "age" }],
};

const server = await startServer({ preview: true });
let browser;
try {
  browser = await launchChromium();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  page.setDefaultTimeout(STEP_TIMEOUT);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(
    ({ world, storageKey }) =>
      localStorage.setItem(storageKey, JSON.stringify(world)),
    { world, storageKey },
  );
  await page.goto(server.url);
  await waitForTank(page);
  // Paused, the habitat stays as seeded while the panels are checked.
  await page.locator("body").press("Space");
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Habitat life", exact: true }).click();
  await page
    .getByRole("button", { name: /Red-eyed tree frog Juvenile/ })
    .click();
  await page.getByText("Juvenile", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("meter", { name: "Condition", exact: true })
      .getAttribute("value"),
    "1",
  );
  await page
    .getByRole("button", { name: "Deselect object", exact: true })
    .click();
  await page.getByRole("button", { name: "Habitat life", exact: true }).click();
  await page.getByRole("button", { name: "Life log", exact: true }).click();
  await page
    .getByRole("list", { name: "Life log", exact: true })
    .getByText("Red-eyed tree frog died of old age.")
    .waitFor();

  // Phones reach the same panel from the tools dock.
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Life", exact: true })
    .click();
  await page.getByText("3 inhabitants", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: life panel, juvenile details and life log on desktop and phone",
  );
} finally {
  await browser?.close();
  await server.stop();
}
