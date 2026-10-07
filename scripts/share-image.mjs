/** Generate the link preview from the actual app, with its normal assets. */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5194";
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    root,
    "--host",
    "127.0.0.1",
    "--port",
    "5194",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(url);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
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
    viewport: { width: 1200, height: 630 },
  });
  await page.goto(url);
  await page
    .getByRole("dialog", { name: "New world" })
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page
    .getByRole("button", { name: "Pause life (Space)", exact: true })
    .click();
  await page.waitForTimeout(2500);
  await page.addStyleTag({
    content: `
    .mode-switch, .scene-tools, .view-info { display: none !important; }
    .preview-caption { position: fixed; z-index: 10; left: 44px; bottom: 32px; color: #f0f3e9;
      font: 500 20px/1.5 system-ui, sans-serif; text-shadow: 0 2px 20px #08130e; }
    .preview-caption h1 { margin: 0 0 3px; font-size: 46px; letter-spacing: -2px; }
    .preview-url { position: fixed; z-index: 10; right: 40px; bottom: 37px; color: #a1b7a2;
      font: 14px system-ui, sans-serif; }
  `,
  });
  await page.evaluate(() => {
    const caption = document.createElement("div");
    caption.className = "preview-caption";
    caption.innerHTML =
      "<h1>Paludarium</h1>A tiny living world. Yours to shape.";
    document.body.append(caption);
    const url = document.createElement("div");
    url.className = "preview-url";
    url.textContent = "turnerburchard.com/paludarium";
    document.body.append(url);
  });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
  await page.screenshot({
    path: `${root}public/share.jpg`,
    type: "jpeg",
    quality: 85,
  });
  console.log("public/share.jpg (1200 × 630)");
} finally {
  await browser?.close();
  server.kill();
}
