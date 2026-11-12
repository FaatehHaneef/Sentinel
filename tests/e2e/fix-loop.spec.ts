import { expect, test } from "@playwright/test";
import type { RunRecord } from "@/lib/trial/types";

/**
 * The whole story: Iris fails to buy, the results page offers a fix for each
 * snag, the fixes are tried on the live page, and on the second walk she gets
 * through and pays with the sandbox.
 */
test("trying the suggested fixes lets Iris complete the purchase", async ({ page, request }) => {
  test.setTimeout(240_000);
  const created = await request.post("/api/runs", { data: { party: ["iris"], pace: "fast" } });
  const { runId, startUrl } = (await created.json()) as { runId: string; startUrl: string };

  // First walk: she leaves at the details form.
  await page.goto(startUrl);
  await page.getByRole("link", { name: "See the full results" }).click({ timeout: 80_000 });
  await expect(page.getByText('Grandma Iris left at "Your details" without buying')).toBeVisible();
  // The summary leads to the detail on separate screens.
  await expect(page.getByText(/a month could be lost/)).toBeVisible();
  await page.getByRole("tab", { name: "Money at risk" }).click();
  await expect(page.getByText("Revenue at risk (estimate)").first()).toBeVisible();
  await page.getByRole("tab", { name: "Problems and fixes" }).click();

  // Every snag comes with a fix, shown as code.
  const first = (await page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "null"),
    `sentinel:run:${runId}`,
  )) as RunRecord;
  const snags = first.events.filter((event) => event.type === "snag");
  expect(snags.length).toBeGreaterThanOrEqual(8);
  expect(snags.every((event) => event.finding.fix)).toBe(true);
  await expect(page.locator("pre", { hasText: "color:" }).first()).toBeVisible();

  // Second walk, with the fixes applied to the live page.
  await page
    .getByRole("button", { name: /Try \d+ fixes and run the trial again/ })
    .first()
    .click();
  await expect(page.locator("sentinel-hud")).toBeAttached({ timeout: 30_000 });
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 150_000 });

  const second = (await page.evaluate(() => {
    const id = window.localStorage.getItem("sentinel:run:latest");
    return JSON.parse(window.localStorage.getItem(`sentinel:run:${id}`) ?? "null");
  })) as RunRecord;
  console.log(
    second.events
      .filter((event) => ["snag", "fixed", "purchase", "abandon", "finish"].includes(event.type))
      .map((event) =>
        event.type === "snag"
          ? `  snag [${event.scene}] ${event.finding.check} ${event.finding.label} :: ${event.finding.measured}`
          : event.type === "fixed"
            ? `  fixed [${event.scene}] ${event.check} ${event.label} (+${event.xp} XP, ${event.coinsSaved} coins kept)`
            : `${event.type} ${JSON.stringify(event)}`,
      )
      .join("\n"),
  );

  expect(second.config.previousRunId).toBe(runId);
  expect(second.fixes?.length).toBe(snags.length);
  const fixed = second.events.filter((event) => event.type === "fixed");
  expect(fixed.length).toBe(snags.length);
  expect(second.events.filter((event) => event.type === "snag")).toHaveLength(0);
  expect(second.events.some((event) => event.type === "purchase")).toBe(true);
  expect(second.events.find((event) => event.type === "finish")).toMatchObject({
    outcome: "purchased",
    coinsLost: 0,
  });

  // The fixes really are on the page: the field has a visible label and readable placeholder.
  await page.getByRole("link", { name: "See the full results" }).click();
  await expect(page.getByText("Completed the purchase").first()).toBeVisible();
  await page.getByRole("tab", { name: "Problems and fixes" }).click();
  await expect(page.getByText("Before and after the fixes")).toBeVisible();
  await expect(page.getByText(/fixes were tried in this trial/)).toBeVisible();
  await page.getByRole("tab", { name: "Money at risk" }).click();
  await expect(page.getByText("Down from")).toBeVisible();
});

test("a fix that is not on the allow-list never reaches the page", async ({ page, request }) => {
  const created = await request.post("/api/runs", { data: { party: ["iris"], pace: "fast" } });
  const { runId } = (await created.json()) as { runId: string };
  const rerun = await request.post("/api/runs", {
    data: { party: ["iris"], pace: "fast", previousRunId: runId },
  });
  const { startUrl } = (await rerun.json()) as { startUrl: string };

  // Plant hostile "fixes" where the re-run will look for them.
  await page.goto("/store");
  await page.evaluate((fromRun) => {
    window.localStorage.setItem(
      "sentinel:fixes",
      JSON.stringify({
        fromRun,
        fixes: [
          {
            check: "x",
            selector: "body > div",
            label: "x",
            fix: {
              summary: "x",
              source: "rule",
              css: [
                {
                  target: "element",
                  declarations: {
                    display: "none",
                    "background-color": "url(https://example.com/x)",
                    color: "#123456",
                  },
                },
              ],
            },
          },
          {
            check: "y",
            selector: "body, html { display: none } x",
            label: "y",
            fix: {
              summary: "y",
              source: "rule",
              css: [{ target: "element", declarations: { color: "#000000" } }],
            },
          },
        ],
      }),
    );
  }, runId);

  await page.goto(startUrl);
  await expect(page.locator("sentinel-hud")).toBeAttached({ timeout: 30_000 });
  const css = await page
    .locator("style[data-sentinel-fixes]")
    .evaluate((style) => style.textContent ?? "");
  expect(css).toContain("color: #123456 !important");
  expect(css).not.toContain("display");
  expect(css).not.toContain("url(");
  expect(css).not.toContain("html");
  await expect(page.getByRole("heading", { name: "Candles for the road home" })).toBeVisible();
});
