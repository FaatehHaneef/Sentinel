import { expect, test } from "@playwright/test";

/**
 * The ledger lists every snag across trials in an AG Grid table, marks the
 * ones the next trial fixed, and lists the trials themselves.
 */
test("the ledger lists snags across trials and marks what was fixed", async ({ page, request }) => {
  test.setTimeout(300_000);
  const created = await request.post("/api/runs", { data: { party: ["cog"], pace: "fast" } });
  const { startUrl } = (await created.json()) as { startUrl: string };
  await page.goto(startUrl);
  await page.getByRole("link", { name: "See the full results" }).click({ timeout: 90_000 });
  await page
    .getByRole("button", { name: /Try 1 fix and run the trial again/ })
    .first()
    .click();
  await page.getByRole("link", { name: "See the full results" }).click({ timeout: 150_000 });
  await page.getByRole("link", { name: "The ledger" }).first().click();

  await expect(page.getByRole("heading", { name: "The ledger" })).toBeVisible();
  const grid = page.getByRole("treegrid").or(page.getByRole("grid")).first();
  await expect(grid).toBeVisible();
  await expect(grid.getByText("Cog").first()).toBeVisible();
  await expect(grid.getByText("The product can be read by a machine")).toBeVisible();
  await expect(grid.getByText("Fixed in the next trial")).toBeVisible();

  // Searching narrows the table.
  await page.getByRole("searchbox", { name: "Search" }).fill("no-such-thing");
  await expect(grid.getByText("Fixed in the next trial")).toHaveCount(0);

  // The trials table opens a trial's results.
  const trials = page.getByRole("treegrid").or(page.getByRole("grid")).nth(1);
  await expect(trials.getByText("Cog").first()).toBeVisible();
  await trials.getByText("Cog").first().click();
  await expect(page.getByRole("heading", { name: "Trial results" })).toBeVisible();
});
