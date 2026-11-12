import { createServer } from "node:http";
import { expect, test } from "@playwright/test";

/**
 * A site that is not Sentinel's: another origin, served here by the test.
 * Its owner has pasted in the Sentinel line. The page has a faint line of
 * text, a picture with no description, and a form the shoppers must never
 * submit.
 */
const OWNER = "http://localhost:3301";

function ownerPage(snippet: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Owner's shop</title></head>
<body style="font-family: sans-serif; background: #ffffff; color: #222222">
  <main>
    <h1>Owner's shop</h1>
    <p style="color: #cccccc">Handmade soap, posted anywhere.</p>
    <img src="/soap.png" width="200" height="120">
    <form action="/subscribe" method="post">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email">
      <button type="submit">Subscribe</button>
    </form>
  </main>
  ${snippet}
</body>
</html>`;
}

/** Serves the owner's site from a real local server on another port, so it is a genuinely different origin. */
async function serveOwnerSite(
  snippet: string,
): Promise<{ submissions: string[]; close: () => Promise<void> }> {
  const submissions: string[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", OWNER);
    if (request.method !== "GET") {
      submissions.push(url.pathname);
      response.writeHead(200, { "Content-Type": "text/plain" }).end("submitted");
      return;
    }
    if (url.pathname === "/soap.png") {
      response
        .writeHead(200, { "Content-Type": "image/png" })
        .end(
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64",
          ),
        );
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(ownerPage(snippet));
  });
  await new Promise<void>((resolve) => server.listen(Number(new URL(OWNER).port), resolve));
  return {
    submissions,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("shoppers observe an owner's own site, never act, and the results come back to Sentinel", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const registered = await request.post("/api/sites", { data: { address: OWNER } });
  expect(registered.ok()).toBe(true);
  const { siteKey, snippet, origin } = (await registered.json()) as {
    siteKey: string;
    snippet: string;
    origin: string;
  };
  expect(origin).toBe(OWNER);
  expect(snippet).toContain(`data-site="${siteKey}"`);

  const site = await serveOwnerSite(snippet);
  const { submissions } = site;
  const created = await request.post("/api/runs", {
    data: { party: ["iris", "echo"], pace: "fast", siteKey },
  });
  expect(created.ok()).toBe(true);
  const { startUrl } = (await created.json()) as { startUrl: string };
  expect(startUrl.startsWith(`${OWNER}/#sentinel=`)).toBe(true);

  await page.goto(startUrl);
  await expect(page.locator("sentinel-hud")).toBeAttached({ timeout: 30_000 });
  const results = page.getByRole("link", { name: "See the full results" });
  await results.waitFor({ timeout: 120_000 });

  // The shoppers looked but did nothing: no form was submitted and the page never left.
  expect(submissions).toEqual([]);
  expect(new URL(page.url()).origin).toBe(OWNER);

  await results.click();
  await expect(page.getByRole("heading", { name: "Trial results" })).toBeVisible();
  // The record came back in the address fragment, and the fragment was then removed.
  expect(page.url()).not.toContain("#record=");
  await expect(page.getByText(OWNER).first()).toBeVisible();
  await expect(page.getByText("Looked around and reported").first()).toBeVisible();
  await page.getByRole("tab", { name: "Problems and fixes" }).click();
  await expect(page.getByText("Contrast").first()).toBeVisible();
  await expect(page.getByText("Picture with no description").first()).toBeVisible();
  // Fixes on an owner's site are code to copy, not something to try here.
  await expect(page.getByRole("button", { name: /run the trial again/ })).toHaveCount(0);
  await expect(page.getByText("The fixes below are code to copy").first()).toBeVisible();
  await site.close();
});

test("a site without the Sentinel line is never touched, and keys cannot be forged", async ({
  page,
  request,
}) => {
  const registered = await request.post("/api/sites", { data: { address: OWNER } });
  const { siteKey } = (await registered.json()) as { siteKey: string };

  // The owner has not pasted the line in: the trial link opens a page that ignores it.
  const site = await serveOwnerSite("");
  const created = await request.post("/api/runs", { data: { party: ["iris"], siteKey } });
  const { startUrl } = (await created.json()) as { startUrl: string };
  await page.goto(startUrl);
  await page.waitForTimeout(2000);
  await expect(page.locator("sentinel-hud")).toHaveCount(0);
  await site.close();

  // A key altered to name another site is refused.
  const [, signature] = siteKey.split(".");
  const forged = `${Buffer.from("https://someone-else.example").toString("base64url")}.${signature}`;
  const refused = await request.post("/api/runs", { data: { party: ["iris"], siteKey: forged } });
  expect(refused.status()).toBe(403);

  // A launch token for the owner's site is refused when called from another site.
  const token = startUrl.split("#sentinel=")[1];
  const elsewhere = await request.post("/api/runs/handshake", {
    data: { token },
    headers: { Origin: "http://localhost:3302" },
  });
  expect(elsewhere.status()).toBe(403);

  // Plain http is refused for anything but local development.
  const insecure = await request.post("/api/sites", { data: { address: "http://shop.example" } });
  expect(insecure.status()).toBe(400);
});
