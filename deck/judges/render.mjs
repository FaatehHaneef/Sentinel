// Renders the judges' guide to deck/judges/sentinel-judges-guide.pdf.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve("deck/judges/guide.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.pdf({ path: "deck/judges/sentinel-judges-guide.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
await browser.close();
