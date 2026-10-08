import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { errorKey } from "@/components/contact/LeadForm";
import { studioErrorKey } from "@/components/studio/StudioApplication";

// Error-envelope parity exercises StudioApplication's exported mapper, not
// Next's router. Mock only the locale-aware navigation adapter so the actual
// component module still loads and the mapper cannot drift behind a duplicate.
vi.mock("@/i18n/navigation", () => ({ Link: "a" }));

/**
 * Ties the form's error messages to the reasons the route actually returns.
 *
 * The two lists matched when written and nothing held them together, so
 * deleting a mapping left the suite green and showed a person the generic
 * "check the details and try again" for a problem the server had named
 * precisely. Same class as the target-rule and message-key parity guards.
 */
const root = path.resolve(import.meta.dirname, "..");
const route = readFileSync(path.resolve(root, "src/app/api/leads/route.ts"), "utf8");
const messages = ["tr", "en"].map((locale) => ({
  locale,
  copy: JSON.parse(readFileSync(path.resolve(root, `messages/${locale}.json`), "utf8")) as {
    leadForm: { errors: Record<string, string> };
    studio: { form: { errors: Record<string, string> } };
  },
}));

/** Field-level rejections a person can act on by editing the form. */
const CORRECTABLE = ["name", "email", "message", "consent"];

describe("every rejection a person can act on has its own message", () => {
  it("finds those reasons in the route at all", () => {
    // A vacuous list would make the next assertion pass for free.
    for (const reason of CORRECTABLE) {
      expect(route, `route no longer returns reason "${reason}"`).toContain(
        `reason: "${reason}"`,
      );
    }
  });

  it.each(CORRECTABLE)("maps %s to something specific, not the generic message", (reason) => {
    expect(errorKey(reason)).toBe(reason);
  });

  it.each(CORRECTABLE)("has %s copy in both languages", (reason) => {
    for (const { locale, copy } of messages) {
      expect(copy.leadForm.errors[reason], `missing ${locale} copy for ${reason}`).toBeTruthy();
    }
  });

  it("has copy for every key errorKey can return", () => {
    // A key with no message crashes the page on t(), which is a worse
    // outcome than the wrong wording.
    const keys = new Set(
      ["generic", "closed", "rateLimited", "unavailable", "tooLarge", "offline"].concat(
        CORRECTABLE,
      ),
    );
    for (const key of keys) {
      for (const { locale, copy } of messages) {
        expect(copy.leadForm.errors[key], `missing ${locale} copy for ${key}`).toBeTruthy();
      }
    }
  });
});

describe("the Studio form shares the API error envelope", () => {
  const cases = [
    ["email", 400, "email"],
    ["message", 400, "problem-long"],
    ["studio_not_accepting_submissions", 503, "closed"],
    ["unknown_backend_detail", 400, "server"],
  ] as const;

  it.each(cases)("maps API error %s at status %s to %s", (error, status, key) => {
    expect(studioErrorKey(error, status)).toBe(key);
  });

  it.each(cases)("has localized copy for the %s mapping", (_error, _status, key) => {
    for (const { locale, copy } of messages) {
      expect(copy.studio.form.errors[key], `missing ${locale} Studio copy for ${key}`).toBeTruthy();
    }
  });
});
