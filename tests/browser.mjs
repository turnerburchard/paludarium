/** What the browser checks share: a browser like CI's, the one slow wait for
 * a tank to be built, and reading the world the page has saved. */
import { chromium } from "playwright";

export const storageKey = "little-worlds:v4";

/** Most steps are a click or a save, so a stuck check fails within seconds
 * and names the step it stuck on. Building a tank is the one exception, with
 * its own wait in `waitForTank`. */
export const STEP_TIMEOUT = 10_000;

/** Chromium with software WebGL, as CI runners have no GPU. */
export function launchChromium() {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-frame-rate-limit",
    ],
  });
}

/** The loading screen covers a tank until it is drawn. Software WebGL on CI
 * can take most of a minute to compile a new world's shaders. */
export async function waitForTank(page) {
  await page.locator("#splash").waitFor({ state: "hidden", timeout: 60_000 });
}

/** The open world, as the page last saved it. */
export function savedWorld(page) {
  return page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved.worlds
      ? saved.worlds.find((entry) => entry.id === saved.activeId).world
      : saved;
  }, storageKey);
}

/** Waits for the page to save a world that passes `check`. */
export async function waitForSave(page, check, failure) {
  const deadline = Date.now() + STEP_TIMEOUT;
  while (!check(await savedWorld(page))) {
    if (Date.now() > deadline)
      throw new Error(`${failure} within ${STEP_TIMEOUT / 1000} seconds.`);
    await page.waitForTimeout(100);
  }
}
