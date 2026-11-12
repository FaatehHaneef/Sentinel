// Renders the deck slides the video uses as 1920×1080 stills in video/build/.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

mkdirSync("video/build", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1.5,
});
const url = `file:///${resolve("deck/index.html").replace(/\\/g, "/")}`;
for (const n of [2, 11, 12]) {
  await page.goto(`${url}#${n}`);
  await page.addStyleTag({
    content:
      ".slide{border:0!important;box-shadow:none!important;--fit:1!important}.counter{display:none}",
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `video/build/slide-${String(n).padStart(2, "0")}.png` });
}
await browser.close();
