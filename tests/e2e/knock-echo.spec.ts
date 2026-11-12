import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
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
        ? `  snag [${event.scene}] ${event.finding.severity}${event.finding.onPath ? " on-path" : ""} ${event.finding.check} ${event.finding.label} :: ${event.finding.measured} :: says: ${event.line}`
        : event.type === "fixed"
          ? `  fixed [${event.scene}] ${event.check} ${event.label}`
          : `${event.type} ${JSON.stringify(event)}`,
    )
    .join("\n");
}

async function walk(page: Page, request: APIRequestContext, character: string): Promise<RunRecord> {
  const created = await request.post("/api/runs", { data: { party: [character], pace: "fast" } });
  expect(created.ok()).toBe(true);
  const { startUrl } = (await created.json()) as { startUrl: string };
  await page.goto(startUrl);
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 90_000 });
  const record = await latestRecord(page);
  console.log(describeEvents(record));
  return record;
}

async function tryFixes(page: Page): Promise<RunRecord> {
  await page.getByRole("link", { name: "See the full results" }).click();
  await page.getByRole("button", { name: /Try \d+ fix(es)? and run the trial again/ }).click();
  await expect(page.locator("sentinel-hud")).toBeAttached({ timeout: 30_000 });
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 150_000 });
  const record = await latestRecord(page);
  console.log(describeEvents(record));
  return record;
}

/**
 * Knock uses only a keyboard and wants two candles. The cart's quantity
 * control is not a real button, so the Tab key never reaches it: he cannot go
 * on, however patient he is. Once it is made a button, he buys two.
 */
test("Knock is stopped by a control the keyboard cannot reach, then buys once it is fixed", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const first = await walk(page, request, "knock");
  const snags = first.events.filter((event) => event.type === "snag");

  const unreachable = snags.filter((event) => event.finding.check === "knock.reachable");
  expect(unreachable.map((event) => event.finding.label).sort()).toEqual(
    ['"+" text', '"-" text', '"remove" text'].sort(),
  );
  const plus = unreachable.find((event) => event.finding.label === '"+" text');
  expect(plus?.finding).toMatchObject({ onPath: true, stops: true, severity: "blocker" });

  expect(first.events.find((event) => event.type === "abandon")).toMatchObject({
    scene: "cart",
    reason: 'could not use the "+" text',
  });
  expect(first.events.find((event) => event.type === "finish")).toMatchObject({
    outcome: "abandoned",
    coinsLost: 360,
  });

  const second = await tryFixes(page);
  expect(second.events.filter((event) => event.type === "snag")).toHaveLength(0);
  expect(second.events.filter((event) => event.type === "fixed")).toHaveLength(snags.length);
  const purchase = second.events.find((event) => event.type === "purchase");
  expect(purchase).toBeDefined();
  const orderId = purchase && "orderId" in purchase ? purchase.orderId : "";
  const order = await request.get(`/api/checkout/order/${orderId}`);
  expect(((await order.json()) as { order: { amount: string } }).order.amount).toBe("36.00");
});

test("the keyboard fix makes the control reachable and pressable with real keys", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const first = await walk(page, request, "knock");

  // Start the re-run at normal pace, so there is time to take over the keyboard at the cart.
  const fixes = first.events.flatMap((event) =>
    event.type === "snag" && event.finding.fix
      ? [
          {
            check: event.finding.check,
            selector: event.finding.selector,
            label: event.finding.label,
            fix: event.finding.fix,
          },
        ]
      : [],
  );
  await page.evaluate(
    (pending) => window.localStorage.setItem("sentinel:fixes", JSON.stringify(pending)),
    { fromRun: first.config.runId, fixes },
  );
  const rerun = await request.post("/api/runs", {
    data: { party: ["knock"], pace: "normal", previousRunId: first.config.runId },
  });
  const { startUrl } = (await rerun.json()) as { startUrl: string };
  await page.goto("/lobby");
  await page.goto(startUrl);

  // When he reaches the cart and finds the control fixed, pause the trial and use real keys.
  await page
    .locator("sentinel-hud .feed")
    .getByText('Fixed: "+" text')
    .first()
    .waitFor({ timeout: 120_000 });
  await page.locator("sentinel-hud").getByRole("button", { name: "Pause" }).click();

  const plus = page.locator("main li [role='button']", { hasText: /^\+$/ });
  await expect(plus).toHaveAttribute("tabindex", "0");
  const quantity = plus.locator("xpath=preceding-sibling::span[1]");
  await expect(quantity).toHaveText("1");
  await plus.focus();
  await page.keyboard.press("Enter");
  await expect(quantity).toHaveText("2");
  await page.keyboard.press("Space");
  await expect(quantity).toHaveText("3");
});

/**
 * Echo listens to the page. She gets through, because everything she has to
 * use has a name, but she meets a picture with no description and a cart link
 * that announces only a number.
 */
test("Echo completes the purchase and reports what a screen reader cannot name", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const first = await walk(page, request, "echo");
  const snags = first.events.filter((event) => event.type === "snag");

  const cartLink = snags.find(
    (event) => event.finding.check === "echo.control-names" && /link/.test(event.finding.label),
  );
  expect(cartLink?.finding.measured).toMatch(/announced as "link, \d+"/);
  expect(cartLink?.line).toMatch(/^I hear: "link, \d+"/);
  expect(cartLink?.finding.fix?.attributes).toEqual({ "aria-label": "Cart" });

  const picture = snags.find((event) => event.finding.check === "echo.image-names");
  expect(picture).toMatchObject({ scene: "product" });
  expect(picture?.finding.fix?.attributes).toEqual({ role: "img", "aria-label": "Dusk Ember" });

  // The details fields are named only by their placeholders: a minor snag each.
  expect(
    snags.filter((event) => event.scene === "details" && event.finding.severity === "minor"),
  ).toHaveLength(2);

  // Product cards hold pictures too, but each card is a link with a name, so they pass.
  expect(
    snags.some((event) => event.scene === "shop" && event.finding.check === "echo.image-names"),
  ).toBe(false);
  expect(first.events.find((event) => event.type === "finish")).toMatchObject({
    outcome: "purchased",
  });

  const second = await tryFixes(page);
  expect(second.events.filter((event) => event.type === "snag")).toHaveLength(0);
  expect(second.events.filter((event) => event.type === "fixed")).toHaveLength(snags.length);
  expect(second.events.find((event) => event.type === "finish")).toMatchObject({
    outcome: "purchased",
    coinsLost: 0,
  });
});

test("all four shoppers walk in one trial, each reporting only their own kind of snag", async ({
  page,
  request,
}) => {
  test.setTimeout(300_000);
  const created = await request.post("/api/runs", {
    data: { party: ["iris", "tobin", "knock", "echo"], pace: "fast" },
  });
  const { startUrl } = (await created.json()) as { startUrl: string };
  await page.goto(startUrl);
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 240_000 });
  const record = await latestRecord(page);

  const finishes = record.events.filter((event) => event.type === "finish");
  expect(finishes.map((event) => `${event.character}:${event.outcome}`)).toEqual([
    "iris:abandoned",
    "tobin:abandoned",
    "knock:abandoned",
    "echo:purchased",
  ]);
  const snags = record.events.filter((event) => event.type === "snag");
  expect(snags.every((event) => event.finding.check.startsWith(`${event.character}.`))).toBe(true);
});
