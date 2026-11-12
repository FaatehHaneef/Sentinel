// Renders the Devpost cover to deck/export/cover.png (3:2, 3000×2000).
//   npx esbuild deck/cover/cover.ts --bundle --format=iife --outfile=deck/cover/cover.js
//   node deck/cover/render.mjs
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1500, height: 1000 },
  deviceScaleFactor: 2,
});
await page.goto(pathToFileURL(resolve("deck/cover/index.html")).href);
await page.waitForSelector("body[data-ready]");
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.screenshot({ path: "deck/export/cover.png" });
await browser.close();
