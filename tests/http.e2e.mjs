/** Actual HTTP origins lack crypto.randomUUID; localhost does not expose that bug. */
import assert from "node:assert/strict";
import { webkit, devices } from "playwright";
import { startServer } from "../scripts/server.mjs";
import {
  launchChromium,
  savedWorld,
  STEP_TIMEOUT,
  storageKey,
  waitForSave,
  waitForTank,
} from "./browser.mjs";

const origin = "http://paludarium.test";
const safari = process.env.TOUCH_BROWSER === "webkit";
const server = await startServer({ preview: true });
const empty = {
  version: 2,
  name: "HTTP empty tank",
  environment: {
    width: 7,
    depth: 4.5,
    substrate: 0.25,
    water: 0,
    springs: [],
    warmth: 0.45,
    brightness: 1,
  },
  objects: [],
};
let browser;
try {
  browser = await (safari ? webkit.launch() : launchChromium());
  const page = await browser.newPage({
    ...devices["iPhone 13"],
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(STEP_TIMEOUT);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Serve the production files on a genuinely untrusted HTTP origin. Loopback
  // origins are considered secure, even when their URLs start with http://.
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${server.url}${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
  await page.addInitScript(
    ({ world, storageKey }) =>
      localStorage.setItem(storageKey, JSON.stringify(world)),
    { world: empty, storageKey },
  );
  await page.goto(origin);
  await waitForTank(page);
  assert.deepEqual(
    await page.evaluate(() => ({
      secure: isSecureContext,
      uuid: typeof crypto.randomUUID,
      random: typeof crypto.getRandomValues,
    })),
    { secure: false, uuid: "undefined", random: "function" },
  );
  await page.getByRole("button", { name: "Build", exact: true }).tap();
  await page
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Add", exact: true })
    .tap();
  await page.getByRole("button", { name: "Animals", exact: true }).tap();
  await page
    .getByRole("button", { name: "Red-eyed tree frog", exact: true })
    .tap();
  await page.waitForTimeout(500);
  const box = await page.locator("canvas").boundingBox();
  await page.touchscreen.tap(
    box.x + box.width * 0.5,
    box.y + box.height * 0.55,
  );
  await waitForSave(
    page,
    (world) => world.objects.length === 1,
    "The frog was not saved",
  );
  const [placed] = (await savedWorld(page)).objects;
  assert.equal(placed.kind, "tree-frog");
  assert.ok(placed.id);
  assert.deepEqual(errors, [], "HTTP placement has no runtime errors");
  console.log(
    `PASS (${safari ? "WebKit" : "Chromium"}): insecure HTTP origin, frog placement and persistence without crypto.randomUUID`,
  );
} finally {
  await browser?.close();
  await server.stop();
}
