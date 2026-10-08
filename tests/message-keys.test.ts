import { describe, expect, it } from "vitest";
import tr from "../messages/tr.json";
import en from "../messages/en.json";

/**
 * Every key a component asks for must exist, in the namespace it asks for,
 * in both catalogues.
 *
 * next-intl renders a missing key as its literal path, so the failure is
 * silent to every gate and loud only to the visitor. It already happened
 * once this session: `claimsHeading` went into `showcase` while ProductPage
 * reads `product`, and the page shipped the string "product.claimsHeading"
 * as a heading until a browser check caught it.
 *
 * The lapsed strings are the reason this file exists. They render only when
 * a claim has actually outrun its window — which is true for no product
 * today — so no test and no browser check touches them. They would fail in
 * front of a reader, on the day something lapses, which is the worst
 * possible moment.
 */
type Catalogue = Record<string, Record<string, unknown>>;

const REQUIRED: Array<[namespace: string, key: string]> = [
  ["product", "claimsHeading"],
  ["product", "claimsLapsedHeading"],
  ["product", "claimsLapsedNote"],
  // Rendered only on a stat whose claim has lapsed — true for no product
  // today, so nothing else touches them. Measured: moving
  // statNeedsReverification to the wrong namespace left the suite green AND
  // `next build` exit 0, while the TR page shipped the literal
  // "product.statNeedsReverification" under its two biggest numbers.
  ["product", "statVerified"],
  ["product", "statNeedsReverification"],
  ["product", "back"],
  ["product", "interfaceKicker"],
  ["projectsIndex", "shippedHeading"],
  ["projectsIndex", "shippedNote"],
  ["projectsIndex", "researchHeading"],
  ["projectsIndex", "researchNote"],
  ["projectsIndex", "researchToggle"],
];

describe.each([
  ["tr", tr as unknown as Catalogue],
  ["en", en as unknown as Catalogue],
])("%s catalogue", (locale, catalogue) => {
  it.each(REQUIRED)("has %s.%s", (namespace, key) => {
    const value = catalogue[namespace]?.[key];
    expect(typeof value, `${locale}: ${namespace}.${key} is missing`).toBe("string");
    expect((value as string).trim(), `${locale}: ${namespace}.${key} is empty`).not.toBe("");
  });

  it("never leaves a key that looks like an unresolved path as a value", () => {
    // "product.claimsHeading" as a VALUE would satisfy the checks above.
    for (const [namespace, key] of REQUIRED) {
      const value = catalogue[namespace]?.[key] as string;
      expect(value, `${locale}: ${namespace}.${key} looks like an unresolved key`).not.toMatch(
        /^[a-z]+\.[a-zA-Z]+$/,
      );
    }
  });
});

describe("the two catalogues agree on these keys", () => {
  it("neither has a required key the other lacks", () => {
    for (const [namespace, key] of REQUIRED) {
      const inTr = (tr as unknown as Catalogue)[namespace]?.[key] !== undefined;
      const inEn = (en as unknown as Catalogue)[namespace]?.[key] !== undefined;
      expect(inTr, `tr missing ${namespace}.${key}`).toBe(inEn);
    }
  });
});
