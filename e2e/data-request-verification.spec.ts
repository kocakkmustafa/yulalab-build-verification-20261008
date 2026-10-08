import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const e2ePort = Number(process.env.YULA_E2E_PORT ?? "4173");

const TOKEN = "a".repeat(64);

test("verification HTTP responses retain their own nonce and referrer policy", async ({ request }) => {
  for (const path of [
    "/data-request/verify",
    "/tr/data-request/verify",
    "/en/data-request/verify",
    "/en/data-request/%76erify",
    "/en/%64ata-request/verify",
    "/%65n/data-request/verify",
    "/%74r/data-request/verify",
  ]) {
    const response = await request.get(path, { maxRedirects: 3 });
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    const nonce = html.match(/<script nonce="([^"]+)"/)?.[1];
    expect(nonce, path).toBeTruthy();
    expect(html).toContain(`<style nonce="${nonce}"`);
    const csp = response.headers()["content-security-policy"];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain(`script-src 'nonce-${nonce}'`);
    expect(csp).toContain(`style-src 'nonce-${nonce}'`);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|vercel/);
    expect(response.headersArray().filter((h) => h.name.toLowerCase() === "content-security-policy")).toHaveLength(1);
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["cross-origin-resource-policy"]).toBe("same-origin");
    const second = await request.get(path, { maxRedirects: 3 });
    expect(second.headers()["content-security-policy"]).not.toBe(csp);
  }
});

test("ordinary not-found neighbors retain the general response policy", async ({ request }) => {
  for (const path of [
    "/en/data-request/verify-child", "/en/data-request/verify.extra",
    "/fr.test/data-request/verify", "/fr%2etest/data-request/verify",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(await response.text()).not.toContain('<script nonce=');
  }
});

for (const locale of ["tr", "en"] as const) {
  test(`${locale} verification keeps the fragment local until explicit action`, async ({ page }) => {
    const route = locale === "tr" ? "/data-request/verify" : "/en/data-request/verify";
    const button = locale === "tr" ? /talebi doğrula/i : /verify request/i;
    let posts = 0;
    let postedBody: unknown;
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.route("**/api/data-request", async (requestRoute) => {
      posts += 1;
      postedBody = requestRoute.request().postDataJSON();
      await requestRoute.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ verified: true }),
      });
    });

    await page.goto(`${route}#token=${TOKEN}`);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    expect(posts).toBe(0);
    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toContain(TOKEN);
    await expect(page.getByRole("status")).toHaveCSS("display", "block");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(9, 6, 14)");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: button })).toBeFocused();
    await expect(page.getByRole("button", { name: button })).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toBeVisible();
    expect(posts).toBe(1);
    expect(postedBody).toEqual({ token: TOKEN });
  });

  test(`${locale} verification explains the no-script state without an inert action`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, locale: "tr-TR" });
    const page = await context.newPage();
    const route = locale === "tr" ? "/data-request/verify" : "/en/data-request/verify";
    try {
      await page.goto(`http://127.0.0.1:${e2ePort}${route}#token=${TOKEN}`);
      await expect(page.getByRole("button")).toHaveCount(0);
      await expect(page.getByText(locale === "tr" ? /JavaScript'i etkinleştirip/ : /enable JavaScript/)).toBeVisible();
      await expect(page.getByRole("link")).toHaveAttribute("href", locale === "tr" ? "/contact" : "/en/contact");
    } finally {
      await context.close();
    }
  });
}

test("malformed fragment is inert, keyboard-safe, and does not overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  let posts = 0;
  await page.route("**/api/data-request", async (requestRoute) => {
    posts += 1;
    await requestRoute.abort();
  });
  await page.goto("/data-request/verify#token=not-a-capability");
  await expect(page).toHaveURL(/\/data-request\/verify$/);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: /doğrula/i })).toHaveCount(0);
  expect(posts).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

for (const failure of ["expired", "network"] as const) {
  test(`${failure} verification failure retains an accessible exit`, async ({ page }) => {
    await page.route("**/api/data-request", async (requestRoute) => {
      if (failure === "network") await requestRoute.abort();
      else await requestRoute.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ verified: false }) });
    });
    await page.goto(`/en/data-request/verify#token=${TOKEN}`);
    await page.getByRole("button", { name: "Verify request" }).click();
    await expect(page.getByRole("alert")).toContainText("could not be verified");
    await expect(page.getByRole("button")).toHaveCount(0);
    await page.getByRole("link", { name: "Back to contact" }).click();
    await expect(page).toHaveURL(/\/en\/contact$/);
  });
}
