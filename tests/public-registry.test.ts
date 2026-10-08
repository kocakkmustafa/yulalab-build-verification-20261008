import { describe, expect, it } from "vitest";
import {
  validateRecord,
  validateRegistry,
  getDefaultVisibleProducts,
  isExpired,
  getSurfaceFreshness,
  getClaimFreshness,
} from "@/lib/public-registry";
import { publicRegistry } from "@/data/public-registry";
import type { ProductPublicRecord } from "@/lib/types";

// A minimal, otherwise-valid record every "make one field invalid" test
// starts from — keeps each test isolated to the one rule it's checking.
function baseRecord(overrides: Partial<ProductPublicRecord> = {}): ProductPublicRecord {
  return {
    slug: "fixture",
    name: "Fixture",
    lifecycle: "live",
    surfaces: [
      {
        kind: "web",
        url: "https://example.com",
        status: "live",
        source: "https://example.com/status",
        verifiedAt: "2026-08-19",
        expiresAt: "2026-08-20",
      },
    ],
    primaryCta: { labelTr: "Gör", labelEn: "View", url: "https://example.com" },
    screenshots: [],
    claims: [],
    privacyUrl: "/privacy/fixture",
    supportUrl: "/support",
    updatedAt: "2026-08-19",
    ...overrides,
  };
}

describe("validateRecord — structural fail-closed rules (roadmap §6)", () => {
  it("accepts a well-formed record", () => {
    expect(validateRecord(baseRecord())).toEqual([]);
  });

  it("rejects a live/beta surface missing source", () => {
    const r = baseRecord({
      surfaces: [{ ...baseRecord().surfaces[0], source: "" }],
    });
    expect(validateRecord(r).some((e) => /source/i.test(e))).toBe(true);
  });

  it("rejects a live/beta surface missing verifiedAt", () => {
    const r = baseRecord({
      surfaces: [{ ...baseRecord().surfaces[0], verifiedAt: "" }],
    });
    expect(validateRecord(r).some((e) => /verifiedAt/i.test(e))).toBe(true);
  });

  it("rejects a live/beta surface missing expiresAt", () => {
    const r = baseRecord({
      surfaces: [{ ...baseRecord().surfaces[0], expiresAt: "" }],
    });
    expect(validateRecord(r).some((e) => /expiresAt/i.test(e))).toBe(true);
  });

  it("allows a research-lifecycle surface with status coming-soon and no source (nothing to source yet)", () => {
    const r = baseRecord({
      lifecycle: "research",
      surfaces: [
        {
          kind: "ios",
          url: "",
          status: "coming-soon",
          source: "",
          verifiedAt: "",
          expiresAt: "",
        },
      ],
      primaryCta: { labelTr: "Ürünü gör", labelEn: "View product", url: "/projects/fixture" },
    });
    expect(validateRecord(r)).toEqual([]);
  });

  it("rejects a screenshot without sourceBuild on a live product", () => {
    const r = baseRecord({
      screenshots: [
        {
          path: "/x.png",
          sourceBuild: "",
          capturedAt: "2026-08-19",
          altTr: "a",
          altEn: "b",
        },
      ],
    });
    expect(validateRecord(r).some((e) => /sourceBuild/i.test(e))).toBe(true);
  });

  it("rejects a screenshot without capturedAt on a live product", () => {
    const r = baseRecord({
      screenshots: [
        {
          path: "/x.png",
          sourceBuild: "abc123",
          capturedAt: "",
          altTr: "a",
          altEn: "b",
        },
      ],
    });
    expect(validateRecord(r).some((e) => /capturedAt/i.test(e))).toBe(true);
  });

  it("rejects a claim with a TR statement but no EN statement", () => {
    const r = baseRecord({
      claims: [
        {
          id: "c1",
          statementTr: "Bir iddia",
          statementEn: "",
          evidenceKind: "measured",
          source: "x",
          scopeTr: "x",
          scopeEn: "x",
          owner: "x",
          verifiedAt: "2026-08-19",
          expiresAt: "2026-09-18",
        },
      ],
    });
    expect(validateRecord(r).some((e) => /statementEn/i.test(e))).toBe(true);
  });

  it("rejects an asserted claim missing source/scope/owner/verifiedAt/expiresAt", () => {
    const r = baseRecord({
      claims: [
        {
          id: "c1",
          statementTr: "Bir iddia",
          statementEn: "A claim",
          evidenceKind: "measured",
          source: "",
          scopeTr: "",
          scopeEn: "",
          owner: "",
          verifiedAt: "",
          expiresAt: "",
        },
      ],
    });
    const errors = validateRecord(r);
    for (const field of ["source", "scopeTr", "scopeEn", "owner", "verifiedAt", "expiresAt"]) {
      expect(errors.some((e) => e.includes(field)), `expected an error mentioning "${field}"`).toBe(true);
    }
  });

  it("rejects a claim with an EN statement but no TR statement", () => {
    const r = baseRecord({
      claims: [
        {
          id: "c1",
          statementTr: "",
          statementEn: "A claim",
          evidenceKind: "measured",
          source: "x",
          scopeTr: "x",
          scopeEn: "x",
          owner: "x",
          verifiedAt: "2026-08-19",
          expiresAt: "2026-09-18",
        },
      ],
    });
    expect(validateRecord(r).some((e) => /statementTr/i.test(e))).toBe(true);
  });

  it("rejects a research product whose primary CTA points at a store URL", () => {
    const r = baseRecord({
      lifecycle: "research",
      primaryCta: {
        labelTr: "İndir",
        labelEn: "Download",
        url: "https://apps.apple.com/app/id123",
      },
    });
    expect(validateRecord(r).some((e) => /research/i.test(e) && /cta/i.test(e))).toBe(
      true,
    );
  });

  it("accepts a research product whose primary CTA points at the product page", () => {
    const r = baseRecord({
      lifecycle: "research",
      surfaces: [],
      primaryCta: { labelTr: "Ürünü gör", labelEn: "View product", url: "/projects/fixture" },
    });
    expect(validateRecord(r)).toEqual([]);
  });

  it("rejects an unknown lifecycle value (runtime data, not just the TS type)", () => {
    const r = baseRecord({ lifecycle: "unknown" as ProductPublicRecord["lifecycle"] });
    expect(validateRecord(r).some((e) => /lifecycle/i.test(e))).toBe(true);
  });
});

describe("validateRegistry — whole-registry checks", () => {
  it("rejects duplicate slugs", () => {
    const dup = [baseRecord({ slug: "dup" }), baseRecord({ slug: "dup" })];
    expect(validateRegistry(dup).some((e) => /duplicate/i.test(e))).toBe(true);
  });

  it("the real registry (src/data/public-registry.ts) is itself valid", () => {
    expect(validateRegistry(publicRegistry)).toEqual([]);
  });

  it("the real registry has exactly 8 records, matching the live product count", () => {
    expect(publicRegistry).toHaveLength(8);
  });
});

describe("freshness (runtime-only, per TASARIM-RISKI-STORE-EXPIRY-BUILD.md — never build-blocking)", () => {
  it("isExpired is true once now passes expiresAt", () => {
    expect(isExpired("2026-08-01", new Date("2026-08-02"))).toBe(true);
    expect(isExpired("2026-08-01", new Date("2026-07-31"))).toBe(false);
  });

  it("getSurfaceFreshness flags a surface whose expiresAt has passed", () => {
    const r = baseRecord({
      surfaces: [{ ...baseRecord().surfaces[0], expiresAt: "2026-08-01" }],
    });
    const [result] = getSurfaceFreshness(r, new Date("2026-08-19"));
    expect(result.stale).toBe(true);
  });

  it("getClaimFreshness flags a claim whose expiresAt has passed", () => {
    const r = baseRecord({
      claims: [
        {
          id: "c1",
          statementTr: "x",
          statementEn: "y",
          evidenceKind: "measured",
          source: "s",
          scopeTr: "s",
          scopeEn: "s",
          owner: "s",
          verifiedAt: "2026-07-01",
          expiresAt: "2026-07-31",
        },
      ],
    });
    const [result] = getClaimFreshness(r, new Date("2026-08-19"));
    expect(result.stale).toBe(true);
  });

  // KNOWN GAP (flagged by independent Y-P0-003 review, not yet closed):
  // the functions above are correct and tested, but nothing in src/app or
  // src/components calls them yet — no page currently suppresses or flags
  // a stale claim/surface at render time, even though
  // src/data/public-registry.ts's LifeOS iOS surface is already past its
  // 24h expiresAt by design (see that file's comment). Wiring this into
  // the actual product-page/ProofCard rendering is real UI work, tracked
  // for Y-P1-001 alongside the ProjectConfig/registry sync gap below —
  // this test exists so the gap stays visible in test output instead of
  // living only in a comment nobody re-reads.
  it("has a runtime layer that actually distinguishes fresh from lapsed", async () => {
    // Closes the Y-P1-001 todo left by Y-P0-003: isExpired/
    // getSurfaceFreshness existed and NOTHING called them.
    //
    // This asserts the LAYER, on real data. What the page does with it is
    // asserted by rendering it — tests/claims-section.test.tsx — after a
    // reviewer showed that the source-level grep which used to live here
    // survived deleting the whole rendered section, spelling the miscount
    // without the banned token, and filtering lapsed claims out entirely.
    // It also false-fired on a comment that merely mentioned the function.
    // A grep for "does the page render X" is a proxy; rendering it is not.
    const { presentClaims, countLapsedClaims } = await import("@/lib/proof");
    const future = new Date("2099-01-01T12:00:00+03:00");
    for (const record of publicRegistry) {
      const presented = presentClaims(record, future);
      if (presented.length === 0) continue;
      expect(
        countLapsedClaims(record, future),
        `${record.slug} should report lapsed claims in 2099 — if this is 0 the mechanism is inert`,
      ).toBe(presented.length);
    }
  });
});

describe("getDefaultVisibleProducts — archived products excluded by default (roadmap §6)", () => {
  it("excludes archived records", () => {
    const records = [
      baseRecord({ slug: "a", lifecycle: "live" }),
      baseRecord({ slug: "b", lifecycle: "archived" }),
    ];
    const visible = getDefaultVisibleProducts(records);
    expect(visible.map((r) => r.slug)).toEqual(["a"]);
  });

  it("includes live, beta and research", () => {
    const records = [
      baseRecord({ slug: "a", lifecycle: "live" }),
      baseRecord({ slug: "b", lifecycle: "beta" }),
      baseRecord({ slug: "c", lifecycle: "research", surfaces: [] }),
    ];
    expect(getDefaultVisibleProducts(records)).toHaveLength(3);
  });
});
