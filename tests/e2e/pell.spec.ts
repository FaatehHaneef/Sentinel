import { expect, test, type Page } from "@playwright/test";
import type { RunRecord } from "@/lib/trial/types";

async function latestRecord(page: Page): Promise<RunRecord> {
  return page.evaluate(() => {
    const id = window.localStorage.getItem("sentinel:run:latest");
    return JSON.parse(window.localStorage.getItem(`sentinel:run:${id}`) ?? "null");
  });
}

function describeEvents(record: RunRecord): string {
  return record.events
    .filter((event) => ["snag", "fixed", "purchase", "abandon", "finish"].includes(event.type))
    .map((event) =>
      event.type === "snag"
        ? `  snag [${event.scene}] ${event.finding.severity} ${event.finding.check} ${event.finding.label} :: ${event.finding.measured}`
        : event.type === "fixed"
          ? `  fixed [${event.scene}] ${event.check} ${event.label}`
          : `${event.type} ${JSON.stringify(event)}`,
    )
    .join("\n");
}

/**
 * Pell is on a slow rural connection. The shop front's banner is a 1.4 MB
 * picture shown at less than its size, so the page would take far too long
 * and Pell leaves at once. The fix is a change to the store's own code; once
 * it is switched on for the re-run, the page is light and Pell buys.
 */
test("Pell leaves a page that is too heavy, then buys once the banner is fixed", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const created = await request.post("/api/runs", { data: { party: ["pell"], pace: "fast" } });
  const { startUrl } = (await created.json()) as { startUrl: string };
  await page.goto(startUrl);
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 90_000 });
  const first = await latestRecord(page);
  console.log(describeEvents(first));

  const snags = first.events.filter((event) => event.type === "snag");
  const wait = snags.find((event) => event.finding.check === "pell.wait");
  expect(wait?.finding).toMatchObject({
    severity: "blocker",
    stops: true,
    label: "The whole page",
  });
  expect(wait?.finding.measured).toMatch(/about \d+ seconds on Pell's connection \(estimate/);
  const heavy = snags.find((event) => event.finding.check === "pell.heavy-images");
  expect(heavy?.finding.measured).toMatch(/1600 pixels wide but shown at \d+/);
  expect(heavy?.finding.fix?.storeFix).toBe("hero-image");
  expect(first.events.find((event) => event.type === "abandon")).toMatchObject({
    scene: "shop",
    reason: expect.stringMatching(/^gave up waiting: about \d+ seconds/),
  });
  expect(heavy?.finding.label).toBe('"The lantern market at dusk, with candle…" picture');

  // The fix switches on the store's own lighter banner for the re-run.
  await page.getByRole("link", { name: "See the full results" }).click();
  await expect(page.getByText("a change to the demo store's own code").first()).toBeVisible();
  await page
    .getByRole("button", { name: /Try \d+ fix(es)? and run the trial again/ })
    .first()
    .click();
  await expect(page.locator("sentinel-hud")).toBeAttached({ timeout: 30_000 });
  await expect(page.locator("img[src='/store/banner.png']")).toBeVisible();
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 150_000 });
  const second = await latestRecord(page);
  console.log(describeEvents(second));

  expect(second.events.filter((event) => event.type === "snag")).toHaveLength(0);
  expect(second.events.filter((event) => event.type === "fixed")).toHaveLength(snags.length);
  expect(second.events.find((event) => event.type === "finish")).toMatchObject({
    outcome: "purchased",
    coinsLost: 0,
  });

  // The store fix lasts one trial: afterwards the demo store is back to how it was.
  expect(await page.evaluate(() => window.localStorage.getItem("tallowmere-fixes"))).toBeNull();
});

test("Pell still finds the heavy banner when the browser already has it", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  // Iris walks first, so the banner is already in this browser's cache when Pell arrives.
  const created = await request.post("/api/runs", {
    data: { party: ["iris", "pell"], pace: "fast" },
  });
  const { startUrl } = (await created.json()) as { startUrl: string };
  await page.goto(startUrl);
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 150_000 });
  const record = await latestRecord(page);
  const pell = record.events.filter((event) => event.character === "pell");
  console.log(describeEvents({ ...record, events: pell }));
  const heavy = pell.find(
    (event) => event.type === "snag" && event.finding.check === "pell.heavy-images",
  );
  expect(heavy && "finding" in heavy ? heavy.finding.measured : "").toMatch(
    /This picture is 1\.\d MB/,
  );
  expect(pell.find((event) => event.type === "finish")).toMatchObject({ outcome: "abandoned" });
});
