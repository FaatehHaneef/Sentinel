// Records the demo footage from the live app, one clip per scene, paced to the
// voice-over. Frames come from Chrome's screencast at 1920×1080; every clip
// also notes "marks": moments and on-screen boxes that compose.py zooms in on.
//
//   python video/voice.py          (first: the scene and phrase timings)
//   node video/record.mjs          (writes video/build/scene-NN/)
//
// DEMO_BASE overrides the address (default: the live site).
// "node video/record.mjs 1 7" records scenes 1 to 7 only.
// "node video/record.mjs 8" re-records only scenes 8 and 9; it first runs a
// quick Iris and Tobin trial off camera, so the ledger isn't empty.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.DEMO_BASE ?? "https://sentinel-ten-ashy.vercel.app";
const OUT = "video/build";
const timings = JSON.parse(readFileSync("video/voice/timings.json", "utf8"));

const length = (scene) => timings[scene].length;
/** When the first phrase containing this text starts, in seconds into the scene. */
const phrase = (scene, text) => {
  const found = timings[scene].phrases.find((p) => p.text.includes(text));
  if (!found) throw new Error(`No phrase with "${text}" in ${scene}`);
  return found.start;
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1.5,
});
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const cdp = await context.newCDPSession(page);

// ---- Recording -------------------------------------------------------------

let clip = null;
const elapsed = () => Date.now() / 1000 - clip.t0;

cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  if (!clip) return;
  const file = `${String(clip.frames.length).padStart(5, "0")}.jpg`;
  writeFileSync(`${clip.dir}/${file}`, Buffer.from(data, "base64"));
  clip.frames.push({ f: file, t: Math.max(0, metadata.timestamp - clip.t0) });
});
const screencast = () =>
  cdp
    .send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080 })
    .catch(() => {});
await screencast();
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) screencast();
});

/** Where the shopper's panel is now, in CSS pixels (it moves between corners). */
const panelBox = () =>
  page
    .evaluate(() => {
      const panel = document.querySelector("sentinel-hud")?.shadowRoot?.querySelector(".panel");
      if (!panel) return null;
      const r = panel.getBoundingClientRect();
      return r.width ? { x: r.x - 6, y: r.y - 6, w: r.width + 12, h: r.height + 12 } : null;
    })
    .catch(() => null);

async function begin(name) {
  const dir = `${OUT}/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  clip = { name, dir, frames: [], marks: {}, tracks: { panel: [] }, t0: Date.now() / 1000 };
  // A still page sends no screencast frames, so start every clip with a screenshot.
  writeFileSync(`${dir}/start.jpg`, await page.screenshot({ type: "jpeg", quality: 90 }));
  clip.frames.push({ f: "start.jpg", t: 0 });
  const current = clip;
  current.poll = setInterval(async () => {
    const box = await panelBox();
    if (box && clip === current) current.tracks.panel.push({ t: elapsed(), box });
  }, 150);
  console.log(`recording ${name}`);
}

async function end() {
  await page.waitForTimeout(200);
  clearInterval(clip.poll);
  const { dir, frames, marks, tracks } = clip;
  frames.sort((a, b) => a.t - b.t);
  writeFileSync(
    `${dir}/clip.json`,
    JSON.stringify({ viewport: { width: 1280, height: 720 }, frames, marks, tracks }, null, 1),
  );
  console.log(
    `  ${frames.length} frames, ${frames.at(-1)?.t.toFixed(1)} s, marks: ${Object.keys(marks).join(", ")}`,
  );
  clip = null;
}

/** Waits until this many seconds into the clip. */
async function at(seconds) {
  const wait = seconds - elapsed();
  if (wait > 0) await page.waitForTimeout(wait * 1000);
}

/** Notes this moment, and optionally where something is on screen (CSS pixels). */
async function mark(name, locator, grow = 0, extra = {}) {
  let box = null;
  if (locator) {
    const b = await locator.boundingBox().catch(() => null);
    if (b) {
      const [top, right, bottom, left] = Array.isArray(grow) ? grow : [grow, grow, grow, grow];
      box = { x: b.x - left, y: b.y - top, w: b.width + left + right, h: b.height + top + bottom };
    }
  }
  clip.marks[name] = { t: elapsed(), box, ...extra };
}

const hud = page.locator("sentinel-hud");
const feed = hud.locator(".feed");
const highlight = hud.locator(".highlight");
const resultsLink = page.getByRole("link", { name: "See the full results" });
const FROM = Number(process.argv[2] ?? 1);
const TO = Number(process.argv[3] ?? 9);

/** Checks the page every 50 ms until the test passes; survives page loads. */
async function until(test, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await page.evaluate(test).catch(() => false)) return;
    await page.waitForTimeout(50);
  }
  throw new Error(`Timed out after ${timeout} ms: ${test}`);
}
const saying = (words) =>
  `(document.querySelector("sentinel-hud")?.shadowRoot?.querySelector(".say")?.textContent ?? "").includes(${JSON.stringify(words)})`;

if (FROM >= 8) {
  const seed = await (
    await page.request.post(`${BASE}/api/runs`, {
      data: { party: ["iris", "tobin"], pace: "fast" },
    })
  ).json();
  await page.goto(seed.startUrl);
  await resultsLink.click({ timeout: 240_000 });
  await page
    .getByRole("button", { name: /Try \d+ fixes and run the trial again/ })
    .first()
    .click();
  await hud.waitFor({ state: "attached", timeout: 30_000 });
  await resultsLink.waitFor({ timeout: 240_000 });
}

if (FROM <= 7) {
  // ---- 1. Hook: the lobby circle ---------------------------------------------

  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: "Start your trial" }).waitFor();
  await page.waitForTimeout(1800);
  await begin("scene-01");
  await at(length("scene-01") + 0.3);
  await end();

  // ---- 3. Meet the shoppers: the circle walks into a line ---------------------

  const S3 = "scene-03";
  const CAST = [
    ["iris", /^Grandma Iris/, "Grandma Iris"],
    ["tobin", /^Tobin/, "Tobin's hands"],
    ["pell", /^Pell/, "Pell's"],
    ["knock", /^Knock/, "Knock"],
    ["echo", /^Echo/, "Echo"],
    ["dash", /^Dash/, "Dash"],
    ["cog", /^Cog/, "Cog's"],
  ];
  await begin(S3);
  await at(0.8);
  await page.getByRole("button", { name: "Start your trial" }).click();
  for (const [id, name, words] of CAST) {
    await at(phrase(S3, words) - 0.15);
    const label = page.locator("label").filter({ has: page.getByRole("checkbox", { name }) });
    await label.hover();
    await mark(`who-${id}`, label, [130, 4, 4, 4]);
    if (id === "tobin") {
      await page.waitForTimeout(500);
      await page.getByRole("checkbox", { name }).check();
    }
  }
  await at(length(S3) + 0.3);
  await end();

  // ---- 4. Iris walks the checkout ---------------------------------------------

  await page.getByRole("button", { name: "Start the trial" }).click();
  await hud.waitFor({ state: "attached", timeout: 30_000 });
  await begin("scene-04");
  await feed.getByText("Too pale to read").first().waitFor({ timeout: 240_000 });
  await mark("pale", highlight, 14);
  await hud.locator(".name").getByText("Tobin").waitFor({ timeout: 120_000 });
  await mark("iris-gone");
  await end();

  // ---- 5. Tobin's shaky taps --------------------------------------------------

  await begin("scene-05");
  await feed.getByText("Shaky hands keep missing it").first().waitFor({ timeout: 240_000 });
  await mark("taps", highlight, 70);
  await page.waitForTimeout(6000);
  await mark("after-taps");
  await end();
  await resultsLink.waitFor({ timeout: 300_000 });
  await page.waitForTimeout(800);

  // ---- 6. Results -------------------------------------------------------------

  const S6 = "scene-06";
  await begin(S6);
  await at(0.6);
  await resultsLink.click();
  await page.getByRole("tab", { name: "Summary" }).waitFor();
  const money = page.locator("section.pixel-panel.lit", { hasText: "Money at risk" });
  await money.waitFor();
  const amount = Number(
    ((await money.textContent()) ?? "").match(/\$([\d,]+)/)?.[1]?.replace(/,/g, "") ?? 0,
  );
  await at(phrase(S6, "what it's costing") - 0.6);
  await mark("money", money, 10, { value: amount });
  // The verdict card, on the Problems and fixes screen, says when Gemini wrote it.
  await at(phrase(S6, "Gemini writes") - 1.2);
  await page.getByRole("tab", { name: "Problems and fixes" }).click();
  const verdictCard = page.locator("div", { hasText: /^Wick.s verdict/ }).first();
  await verdictCard.waitFor();
  await page
    .getByText("Written by AI (Gemini)")
    .first()
    .waitFor({ timeout: 20_000 })
    .catch(() => console.log("  (the verdict was not written by Gemini this time)"));
  await verdictCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await mark("verdict", verdictCard, 10);
  await at(length(S6) + 0.3);
  await end();

  // ---- 7. Fix and run again ---------------------------------------------------

  const S7 = "scene-07";
  await begin(S7);
  await page.getByRole("tab", { name: "Problems and fixes" }).click();
  const fixCode = page.locator("pre", { hasText: "color:" }).first();
  await fixCode.waitFor();
  await fixCode.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await mark("fix", fixCode, 12);
  await at(phrase(S7, "send the shoppers back") - 0.3);
  await page
    .getByRole("button", { name: /Try \d+ fixes and run the trial again/ })
    .first()
    .click();
  await hud.waitFor({ state: "attached", timeout: 30_000 });
  await mark("rerun");
  await feed
    .getByText(/^Fixed:/)
    .first()
    .waitFor({ timeout: 240_000 });
  await mark("fixed", hud.locator(".panel"), 6);
  await feed.getByText("Purchase completed").first().waitFor({ timeout: 300_000 });
  await mark("paid", hud.locator(".panel"), 6);
  await page.waitForTimeout(2500);
  await end();
  await resultsLink.waitFor({ timeout: 300_000 });
}

if (TO <= 7) {
  await browser.close();
  process.exit(0);
}

// ---- 8. Cog, the AI agent ---------------------------------------------------

const cogRun = await (
  await page.request.post(`${BASE}/api/runs`, { data: { party: ["cog"], pace: "normal" } })
).json();
await page.goto(cogRun.startUrl);
await resultsLink.waitFor({ timeout: 240_000 });
await resultsLink.click();
const tryCogFix = page.getByRole("button", { name: /Try 1 fix and run the trial again/ }).first();
await tryCogFix.waitFor();
await begin("scene-08");
await tryCogFix.click();
await hud.waitFor({ state: "attached", timeout: 30_000 });
await mark("start");
await until(saying("Product data found"), 240_000);
await mark("agent", hud.locator(".panel"), 6);
await until(
  `${saying("Order placed")} || /Thank you/.test(document.querySelector("h1")?.textContent ?? "")`,
  120_000,
);
await mark("order");
await page.getByRole("heading", { name: "Thank you" }).waitFor({ timeout: 120_000 });
const receipt = page
  .locator("div")
  .filter({ hasText: "Payment received" })
  .filter({ hasText: "Paid with" })
  .last();
await page.waitForTimeout(400);
await mark("receipt", receipt, 14);
await feed.getByText("Purchase completed").first().waitFor({ timeout: 120_000 });
await mark("done");
await page.waitForTimeout(2500);
await end();
await resultsLink.waitFor({ timeout: 120_000 });

// ---- 9. Ledger and your own site --------------------------------------------

const S9 = "scene-09";
await page.goto(`${BASE}/ledger`);
const grid = page.getByRole("treegrid").or(page.getByRole("grid")).first();
await grid.waitFor();
await page.evaluate(() => document.getElementById("ledger-heading")?.scrollIntoView());
await page.waitForTimeout(1200);
await begin(S9);
await at(0.5);
await mark("ledger", grid, 8);
await at(phrase(S9, "And on your own site") - 0.6);
await page.goto(`${BASE}/sites`);
const address = page.getByRole("textbox", { name: /address/ });
await address.pressSequentially("https://shop.example", { delay: 45 });
await page.getByRole("button", { name: "Get my line of code" }).click();
const snippet = page.locator("pre").first();
await snippet.waitFor();
await snippet.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await mark("snippet", snippet, 12);
await at(length(S9) + 0.3);
await end();

// The run records, to check every number the narration says.
const records = await page.evaluate(() =>
  Object.keys(localStorage)
    .filter((key) => key.startsWith("sentinel:run:") && key !== "sentinel:run:latest")
    .map((key) => JSON.parse(localStorage.getItem(key))),
);
writeFileSync(`${OUT}/records.json`, JSON.stringify(records, null, 1));
await browser.close();
console.log("done");
