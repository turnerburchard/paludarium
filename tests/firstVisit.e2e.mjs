import assert from "node:assert/strict";
import { devices } from "playwright";

export async function checkFirstVisit(browser, url, sharedHash) {
  for (const mobile of [false, true]) {
    const context = await browser.newContext(
      mobile
        ? { ...devices["iPhone 13"], deviceScaleFactor: 1 }
        : { viewport: { width: 1440, height: 960 } },
    );
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(30_000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const activate = (locator) => (mobile ? locator.tap() : locator.click());
      const dialog = page.getByRole("dialog", {
        name: "New world",
        exact: true,
      });
      const waitForName = (name) =>
        page.waitForFunction(
          (name) =>
            JSON.parse(localStorage.getItem("little-worlds:v1"))?.name === name,
          name,
        );
      await page.goto(url);
      await dialog.waitFor();
      assert.equal(await page.getByRole("dialog").count(), 1);
      assert.equal(await dialog.getByRole("heading").innerText(), "New world");
      assert.equal(await dialog.locator("p").count(), 0);
      assert.equal(await dialog.locator(".preset-options button").count(), 6);
      await page.screenshot({
        path: `/tmp/paludarium-first-visit-${mobile ? "phone" : "desktop"}.png`,
      });
      if (mobile) {
        await activate(
          dialog.getByRole("button", { name: "Empty tank", exact: true }),
        );
        await waitForName("My little world");
        assert.equal(
          await page
            .getByRole("button", { name: "Build", exact: true })
            .getAttribute("aria-pressed"),
          "true",
          "an initial empty tank enters Build",
        );
        await activate(
          page.getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true }),
        );
        await waitForName("Aquarium");
      } else {
        await activate(dialog.getByRole("button", { name: "Close dialog" }));
        await dialog.waitFor({ state: "hidden" });
        await waitForName("Aquarium");
        await activate(
          page.getByRole("button", { name: "Build", exact: true }),
        );
      }
      await activate(
        page.getByRole("button", { name: "New world", exact: true }),
      );
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await activate(
        page.getByRole("button", { name: "New world", exact: true }),
      );
      await activate(
        dialog.getByRole("button", { name: "Empty tank", exact: true }),
      );
      await waitForName("My little world");
      assert.equal(
        await page
          .getByRole("button", { name: "Build", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(await page.locator(".empty-invitation").count(), 0);
      assert.equal(
        await page
          .getByRole("button", { name: "Cloud forest", exact: true })
          .count(),
        0,
      );
      await activate(
        page.getByRole("button", { name: "Undo (⌘/Ctrl Z)", exact: true }),
      );
      await waitForName("Aquarium");
      assert.equal(
        await dialog.count(),
        0,
        "Undo never reopens the first-visit picker",
      );
      await activate(
        page.getByRole("button", { name: "New world", exact: true }),
      );
      await activate(
        dialog.getByRole("button", { name: "Empty tank", exact: true }),
      );
      await waitForName("My little world");
      await page.reload();
      await page.getByRole("button", { name: "Build", exact: true }).waitFor();
      assert.equal(
        await dialog.count(),
        0,
        "a saved empty tank is not a first visit",
      );
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("little-worlds:v1")),
      );
      assert.equal(saved.objects.length, 0);
      const imported = { ...saved, name: "Imported habitat" };
      await page.locator('input[type="file"]').setInputFiles({
        name: "habitat.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(imported)),
      });
      await waitForName(imported.name);
      await page.reload();
      await page.getByRole("button", { name: "Build", exact: true }).waitFor();
      assert.equal(
        await dialog.count(),
        0,
        "imported worlds bypass the picker",
      );
      await waitForName(imported.name);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
  const shared = await browser.newPage();
  try {
    await shared.goto(url + "/" + sharedHash);
    await shared.getByRole("navigation", { name: "Shared world" }).waitFor();
    assert.equal(
      await shared
        .getByRole("dialog", { name: "New world", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await shared.evaluate(() => localStorage.getItem("little-worlds:v1")),
      null,
      "a fresh shared-world visit leaves local storage untouched",
    );
  } finally {
    await shared.close();
  }
  console.log(
    "PASS: desktop/mobile first-visit picker, close/Escape/reopen, empty Build, Undo, saved/imported/shared worlds",
  );
}
