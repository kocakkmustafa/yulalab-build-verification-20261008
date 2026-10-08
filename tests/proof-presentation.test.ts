import { describe, expect, it } from "vitest";
import {
  presentClaims,
  presentSurfaces,
  countLapsed,
} from "@/lib/proof";
import { publicRegistry } from "@/data/public-registry";
import type { ProductPublicRecord } from "@/lib/types";

const NOW = new Date("2026-08-19T12:00:00Z");

function record(overrides: Partial<ProductPublicRecord> = {}): ProductPublicRecord {
  return {
    slug: "fixture",
    name: "Fixture",
    lifecycle: "live",
    surfaces: [],
    primaryCta: { labelTr: "Gör", labelEn: "View", url: "https://example.com" },
    screenshots: [],
    claims: [],
    privacyUrl: "/privacy",
    supportUrl: "/support",
    updatedAt: "2026-08-19",
    ...overrides,
  };
}

function claim(id: string, expiresAt: string) {
  return {
    id,
    statementTr: `TR ${id}`,
    statementEn: `EN ${id}`,
    evidenceKind: "measured" as const,
    source: "https://example.com/proof",
    scopeTr: "kapsam",
    scopeEn: "scope",
    owner: "owner",
    verifiedAt: "2026-07-01",
    expiresAt,
  };
}

describe("claim presentation", () => {
  it("presents a still-verified claim as verified", () => {
    const [presented] = presentClaims(record({ claims: [claim("a", "2026-09-30")] }), NOW);
    expect(presented.kind).toBe("verified");
  });

  it("never presents a lapsed claim as verified", () => {
    // The whole meaning of the verified block is "we checked this". A claim
    // whose verification window closed is not false — it is unchecked — and
    // presenting it there would be the exact over-claim this product exists
    // to prevent.
    const [presented] = presentClaims(record({ claims: [claim("a", "2026-08-01")] }), NOW);
    expect(presented.kind).toBe("lapsed");
  });

  it("keeps a lapsed claim visible rather than silently dropping it", () => {
    // Silently hiding it would shrink the page with nobody noticing that
    // verification lapsed — the failure mode is invisible, which is worse
    // than a visible gap.
    const presented = presentClaims(record({ claims: [claim("a", "2026-08-01")] }), NOW);
    expect(presented).toHaveLength(1);
    expect(presented[0].claim.id).toBe("a");
  });

  it("carries the date the claim lapsed, not just a boolean", () => {
    const [presented] = presentClaims(record({ claims: [claim("a", "2026-08-01")] }), NOW);
    if (presented.kind !== "lapsed") throw new Error("expected lapsed");
    expect(presented.expiredOn).toBe("2026-08-01");
  });

  it("treats the expiry boundary as still-valid on the day itself", () => {
    // Date-only, which is the ONLY shape the registry contains. The first
    // version of this test passed a timestamp ("2026-08-19T23:59:59Z"); with
    // a real date-only value it returned lapsed, so the property in the test
    // name was not one the code had. Boundary detail now lives in
    // tests/expiry-boundary.test.ts.
    const [presented] = presentClaims(record({ claims: [claim("a", "2026-08-19")] }), NOW);
    expect(presented.kind).toBe("verified");
  });

  it("separates two claims independently", () => {
    const presented = presentClaims(
      record({ claims: [claim("fresh", "2026-09-30"), claim("old", "2026-01-01")] }),
      NOW,
    );
    expect(presented.map((p) => p.kind)).toEqual(["verified", "lapsed"]);
  });
});

describe("surface presentation", () => {
  const surface = (expiresAt: string) => ({
    kind: "ios" as const,
    url: "https://apps.apple.com/app/id1",
    status: "live" as const,
    source: "https://example.com/asc",
    verifiedAt: "2026-07-01",
    expiresAt,
  });

  it("keeps the link but withdraws the status assertion when stale", () => {
    // A store link still works when nobody re-checked it this week; what
    // expires is our claim that it is live, not the URL.
    const [presented] = presentSurfaces(record({ surfaces: [surface("2026-08-01")] }), NOW);
    expect(presented.statusConfirmed).toBe(false);
    expect(presented.surface.url).toBe("https://apps.apple.com/app/id1");
  });

  it("confirms the status while still inside the window", () => {
    const [presented] = presentSurfaces(record({ surfaces: [surface("2026-09-30")] }), NOW);
    expect(presented.statusConfirmed).toBe(true);
  });
});

describe("page-level lapse count", () => {
  it("counts lapsed claims and surfaces together", () => {
    const r = record({
      claims: [claim("a", "2026-01-01"), claim("b", "2026-12-01")],
      surfaces: [
        {
          kind: "web",
          url: "https://example.com",
          status: "live",
          source: "s",
          verifiedAt: "2026-07-01",
          expiresAt: "2026-01-01",
        },
      ],
    });
    expect(countLapsed(r, NOW)).toBe(2);
  });

  it("is zero for a fully fresh record", () => {
    expect(countLapsed(record({ claims: [claim("a", "2026-12-01")] }), NOW)).toBe(0);
  });
});

describe("against the real registry", () => {
  it("every product presents without throwing", () => {
    for (const r of publicRegistry) {
      expect(() => presentClaims(r, NOW)).not.toThrow();
      expect(() => presentSurfaces(r, NOW)).not.toThrow();
    }
  });

  it("reports today's real lapse count per product", () => {
    // Not asserting zero: expiry is a measurement of how recently someone
    // re-verified, and it lapsing is a fact about us, not a test failure.
    // This asserts the mechanism runs on real data and produces a number.
    const counts = publicRegistry.map((r) => countLapsed(r, NOW));
    expect(counts).toHaveLength(publicRegistry.length);
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(0);
  });
});

describe("claims and surfaces are counted separately", () => {
  // Regression guard for a defect real data exposed: a product whose single
  // claim was fine but whose 24-hour store-status window had closed would
  // have been headed "1 claim needs re-verification". Store surfaces lapse
  // almost daily by design; folding them into a claims counter makes the
  // warning permanent and therefore ignorable.
  const withStaleSurfaceOnly = record({
    claims: [claim("fresh", "2026-12-01")],
    surfaces: [
      {
        kind: "ios",
        url: "https://apps.apple.com/app/id1",
        status: "live",
        source: "s",
        verifiedAt: "2026-08-18",
        expiresAt: "2026-08-18",
      },
    ],
  });

  it("reports zero lapsed CLAIMS when only a surface is stale", async () => {
    const { countLapsedClaims } = await import("@/lib/proof");
    expect(countLapsedClaims(withStaleSurfaceOnly, NOW)).toBe(0);
  });

  it("still reports the stale surface separately", async () => {
    const { countLapsedSurfaces } = await import("@/lib/proof");
    expect(countLapsedSurfaces(withStaleSurfaceOnly, NOW)).toBe(1);
  });

  it("keeps the combined count for health checks", () => {
    expect(countLapsed(withStaleSurfaceOnly, NOW)).toBe(1);
  });

  it("heads the claims section with the claim count on today's real data", async () => {
    const { countLapsedClaims } = await import("@/lib/proof");
    const lifeos = publicRegistry.find((r) => r.slug === "lifeos")!;
    // The exact case measured on 2026-08-19: one claim, fine; one surface, stale.
    expect(countLapsedClaims(lifeos, new Date("2026-08-19T12:00:00Z"))).toBe(0);
  });
});
