// Captures screenshots of Sentinel for the README, the deck and the "Who it's for"
// section, into public/showcase/. Needs the app running locally:
//
//   npm run build && SENTINEL_AI=off npx next start -p 3210
//   node scripts/capture-showcase.mjs
import { mkdirSync } from "node:fs";
import { chromium, request } from "@playwright/test";

const BASE = process.env.SHOWCASE_BASE ?? "http://localhost:3210";
const OUT = "public/showcase";
mkdirSync(OUT, { recursive: true });

const api = await request.newContext({ baseURL: BASE });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const startRun = async (party, pace = "normal") =>
  (await (await api.post("/api/runs", { data: { party, pace } })).json()).startUrl;

// The landing circle and the line.
await page.goto(`${BASE}/`);
await page.waitForTimeout(1800);
await shot("lobby-circle");
await page.getByRole("button", { name: "Start your trial" }).click();
await page.waitForTimeout(2600);
await page.getByRole("checkbox", { name: /Tobin/ }).check();
await page.waitForTimeout(400);
await shot("lobby-line");

// Iris at the details form, the problem she found outlined.
await page.goto(await startRun(["iris"]));
const feed = page.locator("sentinel-hud .feed");
await feed.getByText("Too pale to read").first().waitFor({ timeout: 120000 });
await page.waitForTimeout(500);
await shot("trial");
await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 120000 });
await page.waitForTimeout(400);
await shot("trial-end");

// The results summary, and the problems with their fixes.
await page.getByRole("link", { name: "See the full results" }).click();
await page.getByRole("tab", { name: "Summary" }).waitFor();
await page.waitForTimeout(900);
await shot("results");
await page.getByRole("tab", { name: "Problems and fixes" }).click();
await page.locator("pre").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await shot("fixes");

// The re-run: Iris gets through.
await page
  .getByRole("button", { name: /Try \d+ fixes/ })
  .first()
  .click();
await page
  .locator("sentinel-hud .feed")
  .getByText(/^Fixed:/)
  .first()
  .waitFor({ timeout: 120000 });
await page.waitForTimeout(400);
await shot("rerun");

// Tobin's shaky taps, and Dash's phone.
await page.goto(await startRun(["tobin"]));
await page
  .locator("sentinel-hud .feed")
  .getByText("Shaky hands keep missing it")
  .first()
  .waitFor({ timeout: 120000 });
await page.waitForTimeout(300);
await shot("taps");
await page.goto(await startRun(["dash"]));
await page.locator('iframe[title="Dash\'s phone"]').waitFor({ state: "attached", timeout: 60000 });
await page.waitForTimeout(3500);
await shot("phone");

// The ledger.
await page.goto(`${BASE}/ledger`);
await page.waitForTimeout(1200);
await page.evaluate(() => document.getElementById("ledger-heading")?.scrollIntoView());
await page.waitForTimeout(400);
await shot("ledger");

await browser.close();
console.log("Saved to", OUT);
