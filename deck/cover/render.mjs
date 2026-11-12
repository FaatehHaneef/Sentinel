// Renders the Devpost cover (deck/export/cover.png, 3:2) and the YouTube
// thumbnail (deck/export/youtube-thumbnail.png, 16:9).
//   npx esbuild deck/cover/cover.ts --bundle --format=iife --outfile=deck/cover/cover.js
//   node deck/cover/render.mjs
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage();
const url = pathToFileURL(resolve("deck/cover/index.html")).href;

// The Devpost cover (3:2), and the YouTube thumbnail (16:9, 1280×720).
for (const [query, size, scale, path] of [
  ["", { width: 1500, height: 1000 }, 2, "deck/export/cover.png"],
  ["?wide", { width: 1600, height: 900 }, 0.8, "deck/export/youtube-thumbnail.png"],
]) {
  const view = await browser.newPage({ viewport: size, deviceScaleFactor: scale });
  await view.goto(url + query);
  await view.waitForSelector("body[data-ready]");
  await view.evaluate(() => document.fonts.ready);
  await view.waitForTimeout(800);
  await view.screenshot({ path });
  await view.close();
}
await page.close();
await browser.close();
