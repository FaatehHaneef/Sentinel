import { expect, test } from "@playwright/test";
import type { RunRecord } from "@/lib/trial/types";

/**
 * Grandma Iris walks Tallowmere. The store has snags planted for her in the
 * checkout's details form. She must find them from measurement alone, lose
 * patience there, and leave without buying.
 */
test("Iris finds the planted snags in the details form and leaves", async ({ page, request }) => {
  const created = await request.post("/api/runs", { data: { party: ["iris"], pace: "fast" } });
  expect(created.ok()).toBe(true);
  const { runId, startUrl } = (await created.json()) as { runId: string; startUrl: string };

  await page.goto(startUrl);
  // The launch token is removed from the address bar as soon as it is read.
  await expect(page).not.toHaveURL(/sentinel=/);

  const resultsLink = page.getByRole("link", { name: "See the full results" });
  await expect(resultsLink).toBeVisible({ timeout: 80_000 });

  const record = await page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "null") as RunRecord | null,
    `sentinel:run:${runId}`,
  );
  expect(record).not.toBeNull();
  const events = record!.events;
  console.log(
    events
      .map((event) =>
        event.type === "snag"
          ? `  snag [${event.scene}] ${event.finding.severity} ${event.finding.check} ${event.finding.label} :: ${event.finding.measured} (-${event.coins}c, -${event.patience}p)`
          : event.type === "pass"
            ? `  pass [${event.scene}] ${event.title} +${event.xp}`
            : `${event.type} ${JSON.stringify(event)}`,
      )
      .join("\n"),
  );

  const snags = events.filter((event) => event.type === "snag");
  const inDetails = snags.filter((event) => event.scene === "details");
  const has = (check: string, label: RegExp) =>
    inDetails.some((event) => event.finding.check === check && label.test(event.finding.label));

  expect(has("iris.contrast", /Full name/)).toBe(true);
  expect(has("iris.contrast", /Email address/)).toBe(true);
  expect(has("iris.labels", /Full name/)).toBe(true);
  expect(has("iris.labels", /Email address/)).toBe(true);
  expect(has("iris.contrast", /Continue to payment/)).toBe(true);
  expect(has("iris.button", /Continue to payment/)).toBe(true);
  expect(has("iris.text-size", /receipt/)).toBe(true);

  // Nothing is reported twice.
  const keys = snags.map((event) => `${event.finding.check}|${event.finding.selector}`);
  expect(new Set(keys).size).toBe(keys.length);

  const finish = events.find((event) => event.type === "finish");
  expect(finish).toMatchObject({ outcome: "abandoned", coinsLeft: 0, coinsLost: 180 });
  expect(events.some((event) => event.type === "purchase")).toBe(false);

  await resultsLink.click();
  await expect(page.getByRole("heading", { name: "Trial results" })).toBeVisible();
  await expect(page.getByText("Left without buying")).toBeVisible();
});

test("a trial cannot start without a launch token from the server", async ({ page, request }) => {
  const forged = await request.post("/api/runs/handshake", {
    data: { token: "eyJhbGciOiJIUzI1NiJ9.eyJydW4iOnt9fQ.forged-signature-forged" },
    headers: { Origin: "http://localhost:3210" },
  });
  expect(forged.status()).toBe(401);

  const created = await request.post("/api/runs", { data: { party: ["iris"] } });
  const { startUrl } = (await created.json()) as { startUrl: string };
  const token = startUrl.split("#sentinel=")[1];
  const elsewhere = await request.post("/api/runs/handshake", {
    data: { token },
    headers: { Origin: "https://someone-else.example" },
  });
  expect(elsewhere.status()).toBe(403);

  // The store with no token: the loader stays asleep and no display appears.
  await page.goto("/store");
  await page.waitForTimeout(1500);
  expect(await page.locator("sentinel-hud").count()).toBe(0);

  // Characters that are not built yet cannot be sent.
  const notReady = await request.post("/api/runs", { data: { party: ["dash"] } });
  expect(notReady.status()).toBe(400);
});
