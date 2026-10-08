import { test, expect } from "@playwright/test";

/**
 * Roadmap Y-P1-001 expects zero horizontal overflow from 320 to 1920.
 *
 * This was not hypothetical: every page scrolled sideways at 320px because
 * the footer's contact address (19 unbreakable characters) needed 152px
 * inside a 116px grid column, which widened the document by 12px. It was
 * site-wide and had shipped. One narrow-viewport assertion would have
 * caught it at any point.
 */
const ROUTES = [
  "/",
  "/en",
  "/projects",
  "/projects/lifeos",
  "/privacy",
  "/transparency",
  "/contact",
];
const WIDTHS = [320, 375, 768, 1440];

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    test(`no horizontal overflow at ${width}px on ${route}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      const { client, scroll } = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(scroll, `${route} at ${width}px scrolls sideways`).toBeLessThanOrEqual(client);
    });
  }
}
