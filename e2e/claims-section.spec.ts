import { test, expect } from "@playwright/test";

/**
 * Page-level proof that the claims section is actually rendered.
 *
 * The component tests cover what it renders; only this catches the section
 * being dropped from the page entirely — which a reviewer demonstrated the
 * previous source-level guard survived, i.e. "computed, rendered nowhere",
 * the exact defect the feature was built to eliminate.
 */
for (const [locale, path, heading] of [
  ["tr", "/projects/burunfarki", "Doğrulanmış iddialar"],
  ["en", "/en/projects/burunfarki", "Verified claims"],
] as const) {
  test.describe(`claims section (${locale})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
    });

    test("renders under a real heading, not a styled paragraph", async ({ page }) => {
      // aria-labelledby pointing at a <p> left the page's most important
      // section invisible to screen-reader heading navigation.
      await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible();
    });

    test("shows each claim with its provenance", async ({ page }) => {
      const section = page.locator("section", { has: page.getByRole("heading", { name: heading }) });
      const items = section.getByRole("listitem");
      await expect(items.first()).toBeVisible();
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
      // Every card carries a verification date.
      for (let i = 0; i < count; i += 1) {
        await expect(items.nth(i)).toContainText(/\d{4}-\d{2}-\d{2}/);
      }
    });

    test("keeps list semantics despite list-style:none", async ({ page }) => {
      const section = page.locator("section", { has: page.getByRole("heading", { name: heading }) });
      await expect(section.getByRole("list").first()).toBeVisible();
    });

    test("makes the public source a followable link", async ({ page }) => {
      const link = page.getByRole("link", { name: /^(source|kaynak)$/i }).first();
      await expect(link).toHaveAttribute("href", /^https:\/\//);
    });

    test("never renders an unopenable path as a link", async ({ page }) => {
      // Internal repo paths are labelled, not linked.
      const section = page.locator("section", { has: page.getByRole("heading", { name: heading }) });
      const hrefs = await section.getByRole("link").evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""),
      );
      for (const href of hrefs) {
        expect(href, `"${href}" is presented as a link but is not a URL`).toMatch(/^https?:\/\//);
      }
    });
  });
}

test("a product with no claims renders no claims section at all", async ({ page }) => {
  // Motion products have zero claims; an empty section with a heading would
  // promise proof that does not exist.
  await page.goto("/en/projects/choreia");
  await expect(page.getByRole("heading", { name: "Verified claims" })).toHaveCount(0);
});

/**
 * Stat cards are the largest numbers on the page. One that restates a
 * registry claim must carry that claim's verification date and go stale
 * with it — otherwise a lapsed claim is flagged in the small print and still
 * asserted as current in 42px type directly above.
 */
test("a stat backed by a claim carries provenance, fresh or lapsed", async ({ page }) => {
  // Either form, deliberately. Asserting only "verified <date>" made this
  // test fail the day the claim expired — 2026-08-22 for this one — and the
  // quickest way to green it would have been bumping expiresAt, which is the
  // single thing this site must never do casually. A lapsed claim is a
  // correct state, not a broken test.
  await page.goto("/en/projects/burunfarki");
  const top3 = page.getByText("~%62", { exact: true }).first();
  await expect(top3).toBeVisible();
  const card = top3.locator("xpath=ancestor::div[contains(@class,'glass')][1]");
  await expect(card).toContainText(/verified \d{4}-\d{2}-\d{2}|needs re-verification/i);
});

test("a stat with no claim behind it carries no invented provenance", async ({ page }) => {
  await page.goto("/en/projects/lifeos");
  const domains = page.getByText("Life domains", { exact: true });
  const card = domains.locator("xpath=ancestor::div[contains(@class,'glass')][1]");
  await expect(card).toBeVisible();
  await expect(card).toContainText("5");
  await expect(card).not.toContainText(/verified/i);
});
