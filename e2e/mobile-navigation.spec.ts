import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ locale: "tr-TR", extraHTTPHeaders: { "Accept-Language": "tr" } });

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return ["localhost", "127.0.0.1"].includes(host) ? route.continue() : route.abort();
  });
});

test("Links aliases redirect before locale rewriting with no forwarded query", async ({ request }) => {
  for (const path of ["/links", "/tr/links", "/en/links"]) {
    const response = await request.get(`${path}?returnTo=https://evil.example&email=private`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(`https://links.yulalab.com/${path.startsWith("/en/") ? "?lang=en" : ""}`);
  }
});

for (const locale of ["tr", "en"] as const) {
  test.describe(`mobile navigation (${locale})`, () => {
    test.use({ viewport: { width: 390, height: 844 } });
    const prefix = locale === "en" ? "/en" : "";
    const menuName = locale === "tr" ? "Menü" : "Menu";
    const closeName = locale === "tr" ? "Kapat" : "Close";

    test("keeps keyboard focus in the menu and restores it on dismissal", async ({ page }) => {
      await page.goto(`${prefix}/contact`);
      const menu = page.locator("header button[aria-controls='site-mobile-navigation']");
      await menu.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: menuName, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: closeName, exact: true })).toBeFocused();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      for (let index = 0; index < 12; index++) {
        await page.keyboard.press(index % 2 ? "Tab" : "Shift+Tab");
        const backgroundFocused = await page.evaluate(() => {
          const active = document.activeElement;
          return active instanceof HTMLElement && active.matches("a,button,input") &&
            !document.querySelector("dialog")?.contains(active);
        });
        expect(backgroundFocused).toBe(false);
      }
      expect((await new AxeBuilder({ page }).include("dialog").analyze()).violations).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(menu).toBeFocused();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await menu.click();
      await dialog.getByRole("button", { name: closeName, exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(menu).toBeFocused();
      await menu.click();
      await page.locator(".mm-overlay").click({ position: { x: 5, y: 100 } });
      await expect(dialog).not.toBeVisible();
      await expect(menu).toBeFocused();
    });

    test("switches language at the account deletion section and closes the menu", async ({ page }) => {
      await page.goto(`${prefix}/privacy/motion#motion-account-deletion`);
      await page.getByRole("button", { name: menuName, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: menuName, exact: true });
      await dialog.getByRole("button", { name: /TR\/EN/ }).click();
      const otherPrefix = locale === "tr" ? "/en" : "";
      await expect(page).toHaveURL(new RegExp(`${otherPrefix}/privacy/motion#motion-account-deletion$`));
      await expect(page.locator("dialog")).not.toBeVisible();
      await expect(page.locator("#motion-account-deletion")).toBeInViewport();
    });

    test("releases the modal when resizing to desktop or following a link", async ({ page }) => {
      await page.goto(`${prefix}/contact`);
      const menu = page.getByRole("button", { name: menuName, exact: true });
      await menu.click();
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(page.locator("dialog")).not.toHaveAttribute("open", "");
      await page.locator("header nav a").first().focus();
      await expect(page.locator("header nav a").first()).toBeFocused();
      await page.setViewportSize({ width: 390, height: 844 });
      await menu.click();
      const projectLinks = page.getByRole("dialog").locator(`a[href='${prefix}/projects']`);
      await projectLinks.first().click();
      await expect(page).toHaveURL(new RegExp(`${prefix}/projects$`));
      await expect(page.locator("dialog")).not.toBeVisible();
    });

    test("closes the menu when browser Back changes the page", async ({ page }) => {
      await page.goto(`${prefix}/manifesto`);
      await page.getByRole("button", { name: menuName, exact: true }).click();
      await page.getByRole("dialog").locator(`a[href='${prefix}/contact']`).click();
      await expect(page).toHaveURL(new RegExp(`${prefix}/contact$`));
      await page.getByRole("button", { name: menuName, exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${prefix}/manifesto$`));
      await expect(page.locator("dialog")).not.toBeVisible();
    });
  });
}
