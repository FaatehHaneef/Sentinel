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
    .filter((event) =>
      ["snag", "fixed", "action", "purchase", "abandon", "finish"].includes(event.type),
    )
    .map((event) =>
      event.type === "snag"
        ? `  snag [${event.scene}] ${event.finding.severity} ${event.finding.check} ${event.finding.label} :: ${event.finding.measured}`
        : event.type === "fixed"
          ? `  fixed [${event.scene}] ${event.check} ${event.label}`
          : event.type === "action"
            ? `  action [${event.scene}] ${event.text}`
            : `${event.type} ${JSON.stringify(event)}`,
    )
    .join("\n");
}

/**
 * Cog is an AI shopping agent. Tallowmere publishes no machine-readable
 * product data, so Cog cannot confirm the price and leaves at the product
 * page. Once the store publishes it, Cog's agent decides to buy and the
 * server places a sandbox order without anyone pressing the pay button.
 */
test("Cog cannot buy without product data, then its agent orders once the data is published", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const created = await request.post("/api/runs", { data: { party: ["cog"], pace: "fast" } });
  const { startUrl } = (await created.json()) as { startUrl: string };
  await page.goto(startUrl);
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 90_000 });
  const first = await latestRecord(page);
  console.log(describeEvents(first));

  const snags = first.events.filter((event) => event.type === "snag");
  expect(snags.map((event) => event.finding.check)).toEqual(["cog.product-data"]);
  expect(snags[0].finding.fix?.storeFix).toBe("product-data");
  expect(first.events.find((event) => event.type === "abandon")).toMatchObject({
    scene: "product",
    reason: expect.stringMatching(/^could not confirm what it would pay/),
  });

  await page.getByRole("link", { name: "See the full results" }).click();
  await page
    .getByRole("button", { name: /Try 1 fix and run the trial again/ })
    .first()
    .click();
  await expect(page.locator("sentinel-hud")).toBeAttached({ timeout: 30_000 });
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 150_000 });
  const second = await latestRecord(page);
  console.log(describeEvents(second));

  expect(second.events.filter((event) => event.type === "snag")).toHaveLength(0);
  expect(second.events.filter((event) => event.type === "fixed")).toHaveLength(1);
  const actions = second.events
    .filter((event) => event.type === "action")
    .map((event) => event.text);
  // The agent is asked exactly once.
  expect(actions.filter((text) => text === "Reads the data: Dusk Ember, 18.00 USD")).toHaveLength(
    1,
  );
  expect(actions.some((text) => /could not be reached/.test(text))).toBe(false);
  // Tests run with AI switched off, so the agent's rules decide.
  expect(
    actions.some((text) =>
      text.startsWith("Agent (rules, AI unavailable): Dusk Ember is in stock"),
    ),
  ).toBe(true);
  // Cog never pressed the checkout's buttons: it went from the product page straight to its order.
  expect(actions.some((text) => /Pays with|Continues to payment|Goes to checkout/.test(text))).toBe(
    false,
  );

  const purchase = second.events.find((event) => event.type === "purchase");
  expect(purchase).toBeDefined();
  const orderId = purchase && "orderId" in purchase ? purchase.orderId : "";
  const order = await request.get(`/api/checkout/order/${orderId}`);
  expect(((await order.json()) as { order: { amount: string } }).order.amount).toBe("18.00");
});

test("the order route refuses data that disagrees with the store and other addresses", async ({
  request,
}) => {
  const customer = { name: "Cog Agent", email: "cog@example.com" };
  const product = { name: "Dusk Ember", sku: "dusk-ember", price: "1.00", currency: "USD" };
  const headers = { Origin: "http://localhost:3210" };

  const cheap = await request.post("/api/agent/order", {
    data: { product, quantity: 1, customer },
    headers,
  });
  expect(await cheap.json()).toMatchObject({
    ok: false,
    reason: expect.stringMatching(/store charges 18.00/),
  });

  const unknown = await request.post("/api/agent/order", {
    data: { product: { ...product, sku: "gold-bar", price: "18.00" }, quantity: 1, customer },
    headers,
  });
  expect(await unknown.json()).toMatchObject({ ok: false });

  const elsewhere = await request.post("/api/agent/order", {
    data: { product: { ...product, price: "18.00" }, quantity: 1, customer },
    headers: { Origin: "https://someone-else.example" },
  });
  expect(elsewhere.status()).toBe(403);
});
