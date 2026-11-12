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
        ? `  snag [${event.character}/${event.scene}] ${event.finding.severity} ${event.finding.check} ${event.finding.label} :: ${event.finding.measured}`
        : event.type === "fixed"
          ? `  fixed [${event.character}/${event.scene}] ${event.check} ${event.label}`
          : `${event.type} ${JSON.stringify(event)}`,
    )
    .join("\n");
}

/**
 * Tobin wants two candles, so he has to use the cart's quantity control. The
 * control is tiny and packed against its neighbours. He must find that from
 * measurement, give up at the cart, and get through once the fixes are tried.
 */
test("Tobin cannot use the tiny quantity control, then buys two candles once it is fixed", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const created = await request.post("/api/runs", { data: { party: ["tobin"], pace: "fast" } });
  expect(created.ok()).toBe(true);
  const { startUrl } = (await created.json()) as { startUrl: string };

  await page.goto(startUrl);
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 80_000 });
  const first = await latestRecord(page);
  console.log(describeEvents(first));

  const snags = first.events.filter((event) => event.type === "snag");
  // Everything he trips on is in the cart, and nothing is reported on the other pages.
  expect(snags.length).toBeGreaterThan(0);
  expect(snags.every((event) => event.scene === "cart")).toBe(true);
  const has = (check: string, label: RegExp, onPath?: boolean) =>
    snags.some(
      (event) =>
        event.finding.check === check &&
        label.test(event.finding.label) &&
        (onPath === undefined || event.finding.onPath === onPath),
    );
  expect(has("tobin.target-size", /"\+"/, true)).toBe(true);
  // The minus control is just as small, but nothing sits close enough to it to be hit by
  // mistake, so it passes the size rule's spacing exception.
  expect(has("tobin.target-size", /"-"/)).toBe(false);
  expect(has("tobin.target-size", /remove/, false)).toBe(true);
  expect(has("tobin.spacing", /"\+"/)).toBe(true);
  expect(has("tobin.risky-neighbour", /remove/)).toBe(true);
  expect(has("tobin.miss-rate", /"\+"/, true)).toBe(true);
  expect(first.events.find((event) => event.type === "finish")).toMatchObject({
    outcome: "abandoned",
    // Two candles at $18: a purse of 360 coins, all lost with the sale.
    coinsLost: 360,
  });

  // Try the fixes and send him again.
  await page.getByRole("link", { name: "See the full results" }).click();
  await expect(page.getByText('Tobin left at "Cart" without buying')).toBeVisible();
  await page
    .getByRole("button", { name: /Try \d+ fixes and run the trial again/ })
    .first()
    .click();
  await expect(page.locator("sentinel-hud")).toBeAttached({ timeout: 30_000 });
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 150_000 });

  const second = await latestRecord(page);
  console.log(describeEvents(second));
  expect(second.events.filter((event) => event.type === "snag")).toHaveLength(0);
  expect(second.events.filter((event) => event.type === "fixed")).toHaveLength(snags.length);
  const purchase = second.events.find((event) => event.type === "purchase");
  expect(purchase).toBeDefined();

  // He really bought two: the sandbox order is for $36.
  const orderId = purchase && "orderId" in purchase ? purchase.orderId : "";
  const order = await request.get(`/api/checkout/order/${orderId}`);
  expect(((await order.json()) as { order: { amount: string } }).order.amount).toBe("36.00");
});

test("two shoppers walk one after the other in a single trial", async ({ page, request }) => {
  test.setTimeout(180_000);
  const created = await request.post("/api/runs", {
    data: { party: ["iris", "tobin"], pace: "fast" },
  });
  const { startUrl } = (await created.json()) as { startUrl: string };

  await page.goto(startUrl);
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 150_000 });
  const record = await latestRecord(page);

  const finishes = record.events.filter((event) => event.type === "finish");
  expect(finishes.map((event) => event.character)).toEqual(["iris", "tobin"]);
  // Each shopper reports only their own kind of snag, and starts with an empty cart.
  const snags = record.events.filter((event) => event.type === "snag");
  expect(snags.every((event) => event.finding.check.startsWith(`${event.character}.`))).toBe(true);
  expect(finishes[0]).toMatchObject({ outcome: "abandoned", coinsLost: 180 });
  expect(finishes[1]).toMatchObject({ outcome: "abandoned", coinsLost: 360 });

  await page.getByRole("link", { name: "See the full results" }).click();
  await expect(page.getByRole("heading", { name: "Grandma Iris" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tobin" })).toBeVisible();
});
