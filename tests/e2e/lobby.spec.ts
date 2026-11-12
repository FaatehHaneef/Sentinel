import { expect, test } from "@playwright/test";

/** The game lobby: the circle, the walk into a line, choosing shoppers, and starting a trial. */
test("the landing circle walks into a line where shoppers are chosen and sent", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sentinel" })).toBeVisible();
  await page.getByRole("button", { name: "Start your trial" }).click();

  // After the walk, every character stands with a name and a tick box. Iris is chosen to begin with.
  const tickBoxes = page.getByRole("checkbox");
  await expect(tickBoxes).toHaveCount(7, { timeout: 10_000 });
  await expect(page.getByRole("checkbox", { name: /Grandma Iris/ })).toBeChecked();

  await page.getByRole("checkbox", { name: /Tobin/ }).check();
  await expect(page.getByText("2 / 7")).toBeVisible();
  await expect(page.getByText("What Tobin checks")).toBeVisible();

  await page.getByRole("button", { name: "Send everyone" }).click();
  await expect(page.getByText("7 / 7")).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("button", { name: "Start the trial" })).toBeDisabled();

  await page.getByRole("checkbox", { name: /Cog/ }).check();
  await page.getByRole("button", { name: "Start the trial" }).click();
  await expect(page).toHaveURL(/\/store/);
  await expect(page.locator("sentinel-hud")).toBeAttached({ timeout: 30_000 });
});

test("the lobby address opens straight in the line", async ({ page }) => {
  await page.goto("/lobby");
  await expect(page.getByRole("checkbox")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Start your trial" })).toHaveCount(0);
});

test("the line has a way back to the circle and shows who Sentinel is for", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start your trial" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(7, { timeout: 10_000 });

  await page.getByRole("button", { name: "Who it's for" }).click();
  await expect(page.getByRole("heading", { name: "A small shop owner" })).toBeVisible();
  await expect(page.getByRole("img", { name: /results summary/ })).toBeVisible();

  await page.getByRole("button", { name: "Back to the road" }).click();
  await expect(page.getByRole("button", { name: "Start your trial" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  // The separate lobby address has the same bar.
  await page.goto("/lobby");
  await expect(page.getByRole("link", { name: "Back to the road" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Who it's for" })).toBeVisible();
});
