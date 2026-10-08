import { describe, expect, it } from "vitest";
import { validateRecord, validateRegistry, isExpired } from "@/lib/public-registry";
import { publicRegistry } from "@/data/public-registry";
import type { ProductPublicRecord } from "@/lib/types";

/**
 * Every date in the registry must be canonical `YYYY-MM-DD`.
 *
 * This is not tidiness. Freshness compares dates lexicographically, which is
 * only correct for zero-padded ISO strings — so `"2026-9-18"`, one missing
 * zero, sorts below every real date and the claim NEVER expires until the
 * year rolls over. Measured before this gate existed: the whole suite stayed
 * green and validateRegistry returned no errors, i.e. a plausible hand-edit
 * silently reproduced the exact "expired claim published as verified" outcome
 * that revalidate=900 was added to prevent.
 *
 * It belongs in the BUILD gate, not at render time: a malformed date is a
 * structural defect in the data, not a statement about how recently someone
 * re-verified something. That is the same split the rest of this file uses.
 */
function claim(overrides: Record<string, string> = {}) {
  return {
    id: "c",
    statementTr: "TR",
    statementEn: "EN",
    evidenceKind: "measured" as const,
    source: "https://example.com",
    scopeTr: "kapsam",
    scopeEn: "scope",
    owner: "o",
    verifiedAt: "2026-07-01",
    expiresAt: "2026-09-18",
    ...overrides,
  };
}

function record(overrides: Partial<ProductPublicRecord> = {}): ProductPublicRecord {
  return {
    slug: "fixture",
    name: "Fixture",
    lifecycle: "live",
    surfaces: [],
    primaryCta: { labelTr: "x", labelEn: "x", url: "/x" },
    screenshots: [],
    claims: [claim()],
    privacyUrl: "/p",
    supportUrl: "/s",
    updatedAt: "2026-08-19",
    ...overrides,
  };
}

describe("malformed dates are rejected at build time", () => {
  it.each([
    ["a missing leading zero in the month", "2026-9-18"],
    ["a missing leading zero in the day", "2026-08-2"],
    ["slashes instead of hyphens", "2026/08/22"],
    ["day-first ordering", "22-08-2026"],
    ["a full timestamp", "2026-08-22T00:00:00Z"],
    ["prose", "yakında"],
    ["an empty string", " "],
  ])("rejects %s in expiresAt", (_label, value) => {
    const errors = validateRecord(record({ claims: [claim({ expiresAt: value })] }));
    expect(errors.join(" ")).toMatch(/expiresAt/);
  });

  it("rejects a malformed verifiedAt too", () => {
    const errors = validateRecord(record({ claims: [claim({ verifiedAt: "2026-7-1" })] }));
    expect(errors.join(" ")).toMatch(/verifiedAt/);
  });

  it("rejects malformed dates on surfaces, not just claims", () => {
    const errors = validateRecord(
      record({
        surfaces: [
          {
            kind: "ios",
            url: "https://apps.apple.com/app/id1",
            status: "live",
            source: "https://example.com",
            verifiedAt: "2026-07-01",
            expiresAt: "2026-8-20",
          },
        ],
      }),
    );
    expect(errors.join(" ")).toMatch(/expiresAt/);
  });

  it("accepts a canonical date", () => {
    expect(validateRecord(record())).toEqual([]);
  });

  it("catches it through validateRegistry, which is what the build runs", () => {
    expect(validateRegistry([record({ claims: [claim({ expiresAt: "2026-9-18" })] })])).not.toEqual([]);
  });
});

describe("why the shape matters", () => {
  it("a non-canonical date would otherwise never expire", () => {
    // Documents the failure this gate prevents, so the reason survives even
    // if someone later wonders why the format is policed.
    expect(isExpired("2026-9-18", new Date("2026-12-31T12:00:00+03:00"))).toBe(false);
    expect(isExpired("2026-09-18", new Date("2026-12-31T12:00:00+03:00"))).toBe(true);
  });
});

describe("the real registry", () => {
  it("uses canonical dates everywhere", () => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    for (const r of publicRegistry) {
      expect(iso.test(r.updatedAt), `${r.slug}.updatedAt`).toBe(true);
      for (const c of r.claims) {
        expect(iso.test(c.verifiedAt), `${r.slug}/${c.id}.verifiedAt`).toBe(true);
        expect(iso.test(c.expiresAt), `${r.slug}/${c.id}.expiresAt`).toBe(true);
      }
      for (const s of r.surfaces) {
        expect(iso.test(s.verifiedAt), `${r.slug}/${s.kind}.verifiedAt`).toBe(true);
        expect(iso.test(s.expiresAt), `${r.slug}/${s.kind}.expiresAt`).toBe(true);
      }
    }
  });
});
