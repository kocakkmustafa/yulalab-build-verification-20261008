import { test, expect } from "@playwright/test";

/**
 * The products index used to render all eight products in one flat grid, so
 * five research apps with no store listing carried the same visual weight
 * as three shipped ones. A grid of eight cards reads as eight products.
 * Roadmap §1.3 / §5.2.
 */
// Headings are written sentence-case in messages/*.json and uppercased with
// CSS. Match the DOM text, not the rendering: Playwright's name matching is
// case-insensitive, but JS lowercasing maps "YAYINDA" to "yayinda" while the
// real string is "Yayında" — dotless ı is not i, so a test that uppercases
// Turkish copy fails for the wrong reason.
for (const [locale, path, shippedHeading, researchHeading, caveat] of [
  ["tr", "/projects", "Yayın kaydı bulunanlar", "Araştırma aşamasındakiler", "Henüz yayınlanmadılar"],
  ["en", "/en/projects", "Publication records", "In research", "Not released yet"],
] as const) {
  test.describe(`products index (${locale})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
    });

    test("shows only shipped products above the fold, research separately", async ({ page }) => {
      const shipped = page.getByRole("heading", { name: shippedHeading, level: 2 });
      await expect(shipped).toBeVisible();
      await expect(page.getByRole("heading", { name: researchHeading, level: 2 })).toBeVisible();
    });

    test("keeps research collapsed by default", async ({ page }) => {
      const details = page.locator("details");
      await expect(details).toHaveCount(1);
      expect(await details.evaluate((d: HTMLDetailsElement) => d.open)).toBe(false);
    });

    test("shows WHY research is held back without needing a click", async ({ page }) => {
      // The disclosure hides the cards, never the caveat. If the reason were
      // inside <details>, the page would look like it is hiding it.
      await expect(page.getByText(caveat, { exact: false })).toBeVisible();
    });

    test("orders headings so research never nests under shipped", async ({ page }) => {
      const outline = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1,h2,h3")).map((h) => h.tagName),
      );
      // H1, then H2 (shipped) + its H3s, then H2 (research) + its H3s.
      expect(outline[0]).toBe("H1");
      expect(outline.filter((t) => t === "H2")).toHaveLength(2);
      const firstH2 = outline.indexOf("H2");
      const lastH2 = outline.lastIndexOf("H2");
      expect(lastH2).toBeGreaterThan(firstH2 + 1); // shipped cards sit between them
    });

    test("opens research from the keyboard alone", async ({ page }) => {
      const summary = page.locator("summary");
      await summary.focus();
      await expect(summary).toBeFocused();
      await page.keyboard.press("Enter");
      expect(await page.locator("details").evaluate((d: HTMLDetailsElement) => d.open)).toBe(true);
      // And the cards are genuinely revealed, not merely marked open.
      await expect(page.locator("details").getByRole("heading", { level: 3 }).first()).toBeVisible();
    });

    test("does not overflow horizontally at 320px", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow, "page scrolls sideways at 320px").toBe(false);
    });
  });
}
