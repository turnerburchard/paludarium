import assert from "node:assert/strict";
import { devices } from "playwright";

export async function checkIdCompatibility(browser, url) {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    deviceScaleFactor: 1,
  });
  context.setDefaultTimeout(30_000);
  try {
    await context.addInitScript(() => {
      Object.defineProperty(crypto, "randomUUID", { value: undefined });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const saved = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("little-worlds:v1")));
    const waitForWorld = (name) =>
      page.waitForFunction(
        (name) =>
          JSON.parse(localStorage.getItem("little-worlds:v1"))?.name === name,
        name,
      );
    const preset = async (name) => {
      await page.getByRole("button", { name: "New world", exact: true }).tap();
      await page
        .getByRole("dialog")
        .getByRole("button", { name, exact: true })
        .tap();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    };
    await page.goto(url);
    await waitForWorld("Aquarium");
    assert.ok(
      (await saved()).objects.length > 0,
      "fresh visits load a habitat",
    );
    await page.getByRole("button", { name: "Build", exact: true }).tap();
    await preset("Cloud forest");
    await waitForWorld("Cloud forest");
    const firstIds = new Set(
      (await saved()).objects.map((object) => object.id),
    );
    await preset("Empty tank");
    await page.locator(".empty-invitation").waitFor();
    await page.getByRole("button", { name: "Cloud forest", exact: true }).tap();
    await page.locator(".empty-invitation").waitFor({ state: "hidden" });
    await page.waitForFunction(
      (ids) => {
        const world = JSON.parse(localStorage.getItem("little-worlds:v1"));
        return (
          world?.objects.length > 0 &&
          world.objects.every((object) => !ids.includes(object.id))
        );
      },
      [...firstIds],
    );
    // Interrupt and reopen the modal before using another preset.
    await page.getByRole("button", { name: "New world", exact: true }).tap();
    await page.getByRole("button", { name: "Close dialog", exact: true }).tap();
    await preset("Aquarium");
    await waitForWorld("Aquarium");
    console.log("PASS: presets without randomUUID");
    const before = await saved();
    await page
      .getByRole("navigation", { name: "Tools" })
      .getByRole("button", { name: "Add", exact: true })
      .tap();
    await page.getByRole("button", { name: "River stone", exact: true }).tap();
    for (const [index, x] of [195, 230].entries()) {
      await page.touchscreen.tap(x, 340);
      await page.waitForFunction(
        (count) =>
          JSON.parse(localStorage.getItem("little-worlds:v1"))?.objects
            .length === count,
        before.objects.length + index + 1,
      );
    }
    const after = await saved();
    assert.equal(
      new Set(after.objects.map((object) => object.id)).size,
      after.objects.length,
    );
    assert.ok(
      after.objects.slice(-2).every((object) => object.kind === "rock"),
    );
    console.log("PASS: native touch placement without randomUUID");
    await page.reload();
    await page.getByRole("button", { name: "About Paludarium" }).waitFor();
    assert.deepEqual(
      await saved(),
      after,
      "reloading preserves existing object ids",
    );
    assert.deepEqual(
      errors,
      [],
      "native touch presets and placement work without randomUUID",
    );
  } finally {
    await context.close();
  }
}
