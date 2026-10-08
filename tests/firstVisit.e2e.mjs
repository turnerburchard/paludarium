import assert from "node:assert/strict";

export async function checkFirstVisit(browser, url, hash) {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      hasTouch: width === 390,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    const dialog = page.getByRole("dialog", { name: "Worlds" });
    await dialog.waitFor();
    assert.equal(await dialog.locator(".preset-options button").count(), 6);
    assert.equal(
      await dialog
        .getByText(/A new little world|Start from scratch|ready-made habitat/)
        .count(),
      0,
    );
    await page.screenshot({
      path: `/tmp/paludarium-first-visit-current-${width}.png`,
    });
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.locator(".preset-options").count(), 0);
    await page.getByRole("button", { name: "Worlds", exact: true }).click();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.getByRole("button", { name: "Worlds", exact: true }).click();
    await dialog
      .getByRole("button", { name: "Empty tank", exact: true })
      .click();
    await page.reload();
    await page.getByRole("button", { name: "Worlds", exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.getByRole("button", { name: "Build", exact: true }).click();
    await page.getByRole("button", { name: "Worlds", exact: true }).click();
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await page.locator("input[type=file]").setInputFiles({
      name: "saved.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          name: "Imported first visit check",
          environment: {
            width: 7,
            depth: 4.5,
            substrate: 0.25,
            water: 0,
            light: "day",
            warmth: 0.45,
            brightness: 1,
          },
          objects: [],
        }),
      ),
    });
    await page.waitForFunction(() =>
      document.title.includes("Imported first visit check"),
    );
    await page.reload();
    await page.waitForFunction(() =>
      document.title.includes("Imported first visit check"),
    );
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  const shared = await browser.newPage();
  await shared.goto(url + "/" + hash);
  await shared.getByRole("button", { name: "Worlds", exact: true }).waitFor();
  assert.equal(await shared.getByRole("dialog").count(), 0);
  assert.equal(
    await shared.evaluate(() => localStorage.getItem("little-worlds:v1")),
    null,
  );
  await shared.close();
  console.log(
    "PASS: fresh desktop/mobile Worlds picker, close/Escape/reopen, saved empty and imported reload, shared-link bypass",
  );
}
