import { chromium } from "playwright";
const [, , out, ...views] = process.argv;
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console", m.text()));
for (const [i, v] of views.entries()) {
  await page.goto(`http://localhost:5299/studio.html?${v}`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}-${i}.png` });
}
await browser.close();
