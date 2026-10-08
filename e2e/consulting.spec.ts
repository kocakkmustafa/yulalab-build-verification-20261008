import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const [locale, prefix, title, action] of [
  ["tr", "", "Yapay zekayı işinizde faydaya dönüştürün.", "Projenizi konuşalım"],
  ["en", "/en", "Make AI useful in your business.", "Discuss your project"],
] as const) {
  for (const width of [320, 390, 1440]) {
    test(`${locale} consulting flow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${prefix}/consulting`);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://yulalab.com${prefix}/consulting`);
      await expect(page.locator("form")).toHaveCount(0);
      await page.getByRole("link", { name: action, exact: true }).first().click();
      await expect(page).toHaveURL(/#consulting-contact$/);
      const email = page.locator("[data-consulting-email]");
      await expect(email).toBeVisible();
      const href = await email.getAttribute("href");
      expect(href).toMatch(/^mailto:support@yulalab\.com\?subject=/);
      expect(decodeURIComponent(href!)).toContain(locale === "tr" ? "AI danışmanlığı görüşmesi" : "AI consulting enquiry");
      await email.focus();
      await expect(email).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.filter(v => v.impact === "serious" || v.impact === "critical")).toEqual([]);
      await page.screenshot({ path: `../evidence/consulting-${locale}-${width}.png`, fullPage: true });
      if (width === 1440) {
        await page.getByRole("link", { name: locale === "tr" ? "Ürünlerimizi inceleyin" : "Explore our products", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${prefix}/projects$`));
        await page.goto(`${prefix}/contact`);
        await expect(page.getByRole("link", { name: action, exact: true })).toHaveAttribute("href", `${prefix}/consulting`);
        await page.goto(`${prefix}/projects/burunfarki`);
        await expect(page.getByText(locale === "tr" ? /Geliştirme çalışmaları şu anda beklemede/ : /Development is currently on hold/)).toBeVisible();
        await page.goto(prefix || "/");
        await expect(page.locator('[data-experience-static="true"]')).toBeVisible();
        await expect(page.getByRole("link", { name: locale === "tr" ? "AI danışmanlığı" : "AI consulting", exact: true }).first()).toHaveAttribute("href", `${prefix}/consulting`);
      }
      expect(errors).toEqual([]);
    });
  }
}

for (const [prefix, menuName, consultingName, title] of [
  ["", "Menü", "AI danışmanlığı", "Yapay zekayı işinizde faydaya dönüştürün."],
  ["/en", "Menu", "AI consulting", "Make AI useful in your business."],
] as const) {
  test(`preserved modal navigates to consulting (${prefix || 'tr'})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${prefix}/contact`);
    const menu = page.locator("header button[aria-controls='site-mobile-navigation']");
    await menu.click();
    const dialog = page.getByRole("dialog", { name: menuName, exact: true });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => {
        const active = document.activeElement;
        return active && active !== document.body && !active.closest("dialog");
      })).toBe(false);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(menu).toBeFocused();
    await menu.click();
    await dialog.getByRole("link", { name: consultingName, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/consulting$`));
    await expect(page.locator("dialog")).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  });
}
