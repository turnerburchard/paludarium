/** Regenerate library pictures after changing an asset or prebuilt. */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5195";
const server = spawn(
  process.execPath,
  [
    `${root}node_modules/vite/bin/vite.js`,
    root,
    "--host",
    "127.0.0.1",
    "--port",
    "5195",
    "--strictPort",
  ],
  { stdio: "inherit" },
);
server.on("exit", (code) => {
  if (code && !server.killed)
    throw new Error("Thumbnail Vite server exited early");
});
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
  const page = await browser.newPage();
  // A blank page avoids competing with a running habitat for rendering work.
  await page.route("**/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html></html>",
    }),
  );
  await page.goto(url);
  const images = await page.evaluate(async () => {
    const { catalog } = await import("/src/assets/index.ts");
    const { prebuilts } = await import("/src/model/prebuilts.ts");
    const { renderThumbnails } = await import("/scripts/thumbnail-renderer.ts");
    return renderThumbnails([
      ...catalog.map((asset) => asset.kind),
      ...prebuilts.map((prebuilt) => `prebuilt:${prebuilt.id}`),
    ]);
  });
  const directory = `${root}public/thumbnails`;
  await mkdir(directory, { recursive: true });
  const manifest = {};
  let total = 0;
  for (const [key, image] of Object.entries(images)) {
    const bytes = Buffer.from(image.split(",")[1], "base64");
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    const name = `${key.replace(":", "-")}-${hash}.png`;
    await writeFile(`${directory}/${name}`, bytes);
    manifest[key] = `./thumbnails/${name}`;
    total += bytes.length;
  }
  await writeFile(
    `${root}src/scene/thumbnails.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const current = new Set(
    Object.values(manifest).map((path) => path.split("/").at(-1)),
  );
  for (const name of await readdir(directory)) {
    if (!current.has(name)) await rm(`${directory}/${name}`);
  }
  console.log(`${Object.keys(images).length} thumbnails, ${total} bytes total`);
} finally {
  await browser?.close();
  server.kill();
}
