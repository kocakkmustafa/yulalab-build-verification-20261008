import { describe, expect, it } from "vitest";
import { partitionForIndex, lifecycleRank, latestVerifiedAt } from "@/lib/product-index";
import { publicRegistry } from "@/data/public-registry";
import type { ProductPublicRecord } from "@/lib/types";

function rec(
  slug: string,
  lifecycle: ProductPublicRecord["lifecycle"],
  verifiedAt = "2026-01-01",
): ProductPublicRecord {
  return {
    slug,
    name: slug,
    lifecycle,
    surfaces: [
      {
        kind: "web",
        url: "https://example.com",
        status: "live",
        source: "s",
        verifiedAt,
        expiresAt: "2099-01-01",
      },
    ],
    primaryCta: { labelTr: "x", labelEn: "x", url: "/x" },
    screenshots: [],
    claims: [],
    privacyUrl: "/privacy",
    supportUrl: "/support",
    updatedAt: "2026-01-01",
  };
}

describe("lifecycle ordering", () => {
  it("puts live before beta before research before archived", () => {
    expect(lifecycleRank("live")).toBeLessThan(lifecycleRank("beta"));
    expect(lifecycleRank("beta")).toBeLessThan(lifecycleRank("research"));
    expect(lifecycleRank("research")).toBeLessThan(lifecycleRank("archived"));
  });
});

describe("partitioning the index", () => {
  const records = [
    rec("old-live", "live", "2026-01-01"),
    rec("research-a", "research"),
    rec("new-live", "live", "2026-08-01"),
    rec("beta-one", "beta"),
    rec("gone", "archived"),
  ];

  it("shows only live and beta by default", () => {
    const { primary } = partitionForIndex(records);
    expect(primary.map((r) => r.slug)).toEqual(["new-live", "old-live", "beta-one"]);
  });

  it("sorts by lifecycle first, then by most recently verified", () => {
    // A live product verified last week outranks one verified in January;
    // neither outranks its own lifecycle tier.
    const { primary } = partitionForIndex(records);
    expect(primary[0].slug).toBe("new-live");
    expect(primary[2].lifecycle).toBe("beta");
  });

  it("separates research rather than mixing it with shipped products", () => {
    // Roadmap §1.3: coming-soon cards must not carry equal weight with live
    // ones in the main proof section.
    const { research, primary } = partitionForIndex(records);
    expect(research.map((r) => r.slug)).toEqual(["research-a"]);
    expect(primary.some((r) => r.lifecycle === "research")).toBe(false);
  });

  it("keeps archived out of both default lists", () => {
    const { primary, research, archived } = partitionForIndex(records);
    expect(primary.some((r) => r.lifecycle === "archived")).toBe(false);
    expect(research.some((r) => r.lifecycle === "archived")).toBe(false);
    expect(archived.map((r) => r.slug)).toEqual(["gone"]);
  });

  it("loses nothing — every record lands in exactly one bucket", () => {
    const { primary, research, archived } = partitionForIndex(records);
    const all = [...primary, ...research, ...archived].map((r) => r.slug).sort();
    expect(all).toEqual(records.map((r) => r.slug).sort());
  });
});

describe("verification recency", () => {
  it("uses the most recent surface verification", () => {
    const r = rec("x", "live", "2026-01-01");
    r.surfaces.push({ ...r.surfaces[0], kind: "ios", verifiedAt: "2026-08-15" });
    expect(latestVerifiedAt(r)).toBe("2026-08-15");
  });

  it("falls back to updatedAt when a record has no surfaces", () => {
    const r = rec("x", "research");
    r.surfaces = [];
    expect(latestVerifiedAt(r)).toBe(r.updatedAt);
  });
});

describe("against the real registry", () => {
  it("puts today's three shipped products first and the five Motion apps in research", () => {
    const { primary, research, archived } = partitionForIndex(publicRegistry);
    expect(primary.map((r) => r.slug).sort()).toEqual(["braavolabs", "burunfarki", "lifeos"]);
    expect(research).toHaveLength(5);
    expect(archived).toHaveLength(0);
    // Beta must not outrank a live product.
    expect(primary[primary.length - 1].slug).toBe("braavolabs");
  });
});
