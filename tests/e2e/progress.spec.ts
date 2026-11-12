import { expect, test } from "@playwright/test";

/**
 * The game layer: a trial earns XP and achievements, the end-of-trial panel
 * announces them, and the results page and lobby show the store's level.
 */
test("a trial earns achievements, shown on the panel, the results and the lobby", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const created = await request.post("/api/runs", { data: { party: ["echo"], pace: "fast" } });
  const { startUrl } = (await created.json()) as { startUrl: string };
  await page.goto(startUrl);
  await page.getByRole("link", { name: "See the full results" }).waitFor({ timeout: 90_000 });

  // The trial's own panel announces what it earned and the store's level.
  const hud = page.locator("sentinel-hud");
  await expect(hud.getByText("Achievement: First light")).toBeVisible();
  await expect(hud.getByText(/Store level \d+: /)).toBeVisible();

  await page.getByRole("link", { name: "See the full results" }).click();
  const progress = page.getByRole("region", { name: "Store progress" });
  await expect(progress.getByText("Store level")).toBeVisible();
  await expect(progress.getByText("First light")).toBeVisible();
  await expect(progress.getByText("New")).toBeVisible();
  await expect(progress.getByRole("progressbar")).toBeVisible();

  // Echo met snags, so her clean-purchase achievement is not earned.
  await expect(progress.getByText("Heard clearly (not yet earned)")).toBeAttached();

  await page.goto("/lobby");
  await expect(
    page.getByRole("region", { name: "Store progress" }).getByText("First light"),
  ).toBeVisible();
});
