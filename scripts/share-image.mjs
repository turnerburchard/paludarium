/** Generate the link preview: the logo and wordmark beside a frog among plants. */
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer } from "./server.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const server = await startServer();
const { url } = server;

const card = `<!doctype html>
<html>
  <head>
    <style>
      @font-face {
        font-family: "Fraunces";
        font-weight: 100 900;
        src: url("/fonts/fraunces-latin.woff2") format("woff2");
      }
      body {
        margin: 0;
        width: 1200px;
        height: 630px;
        overflow: hidden;
        background: radial-gradient(90% 120% at 78% 55%, #1d3328, #0c1512 70%);
      }
      /* The header's lockup, scaled up whole so the font keeps the optical
         size it has in the app. */
      .brand {
        position: absolute;
        left: 80px;
        top: 50%;
        transform: translateY(-50%) scale(3.1);
        transform-origin: left center;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 11px;
        color: #e7eadf;
      }
      .brand img {
        width: 42px;
        height: 43px;
      }
      .brand h1 {
        margin: 0;
        font: 350 22px/1.25 "Fraunces", Georgia, serif;
        letter-spacing: -0.25px;
      }
      canvas {
        position: absolute;
        inset: 0;
      }
    </style>
  </head>
  <body>
    <div class="brand">
      <img src="/paludarium-mark-light.svg" alt="" />
      <h1>paludarium</h1>
    </div>
  </body>
</html>`;

let browser;
try {
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
  await page.route(`${url}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: card }),
  );
  await page.goto(url);
  await page.evaluate(async () => {
    const { renderScene } = await import("/scripts/share-scene.ts");
    document.body.append(renderScene(1200, 630));
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${root}public/share.jpg`,
    type: "jpeg",
    quality: 90,
  });
  console.log("public/share.jpg (1200 × 630)");
} finally {
  await browser?.close();
  await server.stop();
}
