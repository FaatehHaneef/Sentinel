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
        ? `  snag [${event.scene}] ${event.finding.severity}${event.finding.onPath ? " on-path" : ""} ${event.finding.check} ${event.finding.label} :: ${event.finding.measured}`
        : event.type === "fixed"
          ? `  fixed [${event.scene}] ${event.check} ${event.label}`
          : `${event.type} ${JSON.stringify(event)}`,
    )
    .join("\n");
}

async function tryFixes(page: Page): Promise<RunRecord> {
  await page.getByRole("link", { name: "See the full results" }).click();
  await page
    .getByRole("button", { name: /Try \d+ fix(es)? and run the trial again/ })
    .first()
    .click();
  await expect(page.locator("sentinel-hud")).toBeAttached({ timeout: 30_000 });
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 150_000 });
  const record = await latestRecord(page);
  console.log(describeEvents(record));
  return record;
}

/**
 * Dash shops on a phone. The page is measured in a phone-sized frame. On a
 * phone the shop front opens a popup over most of the screen, and Dash leaves.
 * With that fixed, Dash gets further and finds a line that slides the page
 * sideways and fields with no autofill, but buys. With those fixed too, the
 * walk is clean.
 */
test("Dash is driven off by a phone popup, then buys, then buys without a snag", async ({
  page,
  request,
}) => {
  test.setTimeout(400_000);
  const created = await request.post("/api/runs", { data: { party: ["dash"], pace: "fast" } });
  const { startUrl } = (await created.json()) as { startUrl: string };
  await page.goto(startUrl);
  // The phone appears beside the page.
  await expect(page.locator('iframe[title="Dash\'s phone"]')).toBeAttached({ timeout: 30_000 });
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 90_000 });
  const first = await latestRecord(page);
  console.log(describeEvents(first));

  const firstSnags = first.events.filter((event) => event.type === "snag");
  // The popup, and the popup's own email field, which offers no help on a phone.
  expect(firstSnags.map((event) => event.finding.check).sort()).toEqual([
    "dash.input-help",
    "dash.popup",
  ]);
  const popup = firstSnags.find((event) => event.finding.check === "dash.popup");
  expect(popup?.finding.label).toBe('The "Join the candle club" popup');
  expect(popup?.finding.measured).toMatch(/covers \d+% of the phone screen/);
  expect(popup?.finding.fix?.storeFix).toBe("phone-popup");
  expect(first.events.find((event) => event.type === "abandon")).toMatchObject({
    scene: "shop",
    reason: expect.stringMatching(/^left at once/),
  });

  const second = await tryFixes(page);
  const secondSnags = second.events.filter((event) => event.type === "snag");
  // With the popup gone, its field is gone too: both count as fixed.
  expect(
    second.events
      .filter((event) => event.type === "fixed")
      .map((event) => event.check)
      .sort(),
  ).toEqual(["dash.input-help", "dash.popup"]);
  // Only the line that refuses to wrap is blamed, not the things it stretches.
  const overflows = secondSnags.filter((event) => event.finding.check === "dash.overflow");
  expect(overflows).toHaveLength(1);
  expect(overflows[0].finding.label).toMatch(/^"Free delivery on orders over \$40/);
  const overflow = overflows[0];
  expect(overflow?.scene).toBe("product");
  expect(overflow?.finding.measured).toMatch(/pixels wide on a 390 pixel screen/);
  const typing = secondSnags.filter((event) => event.finding.check === "dash.input-help");
  expect(typing.map((event) => event.finding.label).sort()).toEqual(
    ['"Email address" field', '"Full name" field'].sort(),
  );
  expect(typing.every((event) => event.finding.onPath)).toBe(true);
  expect(second.events.find((event) => event.type === "finish")).toMatchObject({
    outcome: "purchased",
  });

  const third = await tryFixes(page);
  expect(third.events.filter((event) => event.type === "snag")).toHaveLength(0);
  expect(third.events.filter((event) => event.type === "fixed")).toHaveLength(secondSnags.length);
  expect(third.events.find((event) => event.type === "finish")).toMatchObject({
    outcome: "purchased",
    coinsLost: 0,
  });
});

test("the phone frame never starts a second trial inside itself", async ({ page, request }) => {
  const created = await request.post("/api/runs", { data: { party: ["dash"], pace: "fast" } });
  const { startUrl } = (await created.json()) as { startUrl: string };
  await page.goto(startUrl);
  const phone = page.frameLocator('iframe[title="Dash\'s phone"]');
  await expect(phone.locator("h1")).toBeVisible({ timeout: 30_000 });
  await expect(phone.locator("sentinel-hud")).toHaveCount(0);
  await expect(page.locator("sentinel-hud")).toHaveCount(1);
});
