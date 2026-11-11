import { expect, test } from "@playwright/test";

/**
 * A full purchase on Tallowmere through the payments sandbox, driven the way
 * a shopper would: browse, add to cart, give details, pay by test card.
 */
test("a shopper can buy a candle with a sandbox test card", async ({ page }) => {
  await page.goto("/store");
  await page.getByRole("link", { name: /Dusk Ember/ }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("link", { name: "View cart" }).click();

  await expect(page.getByText("Total $18.00")).toBeVisible();
  await page.getByRole("link", { name: "Checkout" }).click();

  await page.getByPlaceholder("Full name").fill("Iris Test");
  await page.getByPlaceholder("Email address").fill("iris@example.com");
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await page.locator(".braintree-option__card").click();
  await page
    .frameLocator('iframe[name="braintree-hosted-field-number"]')
    .locator("input")
    .first()
    .fill("4111111111111111");
  await page
    .frameLocator('iframe[name="braintree-hosted-field-expirationDate"]')
    .locator("input")
    .first()
    .fill("1230");
  // The security code field is shown only when the sandbox account asks for one.
  const cvv = page.locator('iframe[name="braintree-hosted-field-cvv"]');
  if (await cvv.count()) {
    await cvv.contentFrame().locator("input").first().fill("123");
  }

  await page.getByRole("button", { name: /^Pay \$18\.00$/ }).click();

  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Payment received")).toBeVisible();
  await expect(page.getByText("1 × Dusk Ember")).toBeVisible();
});
