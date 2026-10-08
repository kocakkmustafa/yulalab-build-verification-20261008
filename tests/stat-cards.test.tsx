// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StatCards } from "@/components/projects/StatCards";
import { publicRegistry } from "@/data/public-registry";
import { projects } from "@/data/projects";

afterEach(cleanup);

const LABELS = { verified: "verified", needsReverification: "needs re-verification" };

function product(slug: string) {
  const config = projects.find((p) => p.slug === slug)!;
  const record = publicRegistry.find((r) => r.slug === slug)!;
  return { config, record };
}

/**
 * Boundary instants are DERIVED from the claim rather than hardcoded.
 *
 * The first version used FRESH=2026-08-19 / LATE=2099-01-01, which never
 * probed the real edge — burunfarki's claim expires 2026-08-22, so
 * `claim.expiresAt` was bound to nothing and a component that keyed
 * staleness off `now.getFullYear() >= 2099` passed the whole suite.
 */
function onExpiryDay(expiresAt: string): Date {
  return new Date(`${expiresAt}T12:00:00+03:00`);
}
function dayAfterExpiry(expiresAt: string): Date {
  return new Date(onExpiryDay(expiresAt).getTime() + 86_400_000);
}

function renderFor(slug: string, now: Date) {
  const { config, record } = product(slug);
  return render(
    <StatCards
      slug={slug}
      stats={config.stats}
      record={record}
      locale="en"
      now={now}
      labels={LABELS}
    />,
  );
}

describe("a stat backed by a claim", () => {
  const { record } = product("burunfarki");
  const claim = record.claims.find((c) => c.id === "burunfarki-topk-accuracy")!;

  it("shows the verification date on the last day the claim is valid", () => {
    renderFor("burunfarki", onExpiryDay(claim.expiresAt));
    expect(screen.getAllByText(new RegExp(`verified ${claim.verifiedAt}`)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/needs re-verification/i)).toBeNull();
  });

  it("flips to needing re-verification the very next day", () => {
    // The real boundary, one day either side — not a year 2099 sentinel.
    renderFor("burunfarki", dayAfterExpiry(claim.expiresAt));
    expect(screen.getAllByText(/needs re-verification/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(new RegExp(`verified ${claim.verifiedAt}`))).toBeNull();
  });

  it("marks all three figures the claim covers", () => {
    renderFor("burunfarki", dayAfterExpiry(claim.expiresAt));
    expect(screen.getAllByText(/needs re-verification/i)).toHaveLength(3);
  });
});

describe("resolving the right claim, not just any claim", () => {
  /**
   * A PURPOSE-BUILT fixture, not the real registry.
   *
   * The previous version rendered Braavolabs and asserted that its provider
   * claim is not claims[0] — but its two claims carry identical dates, so
   * `record.claims[0]` rendered the same string and passed. The separating
   * test guarded itself behind `if (earliest === latest) return;`, which
   * fired every run: replacing its body with a deliberately failing
   * assertion left 10/10 green. A test that depends on the real data
   * happening to be distinguishable is a test that stops working the moment
   * it isn't.
   */
  const FIXTURE_RECORD = {
    slug: "fixture",
    name: "Fixture",
    lifecycle: "live" as const,
    surfaces: [],
    primaryCta: { labelTr: "x", labelEn: "x", url: "/x" },
    screenshots: [],
    claims: [
      {
        id: "first-claim",
        statementTr: "İlk",
        statementEn: "First",
        evidenceKind: "measured" as const,
        source: "https://example.com/a",
        scopeTr: "kapsam",
        scopeEn: "scope",
        owner: "o",
        verifiedAt: "2026-01-01",
        expiresAt: "2026-02-01",
      },
      {
        id: "second-claim",
        statementTr: "İkinci",
        statementEn: "Second",
        evidenceKind: "measured" as const,
        source: "https://example.com/b",
        scopeTr: "kapsam",
        scopeEn: "scope",
        owner: "o",
        verifiedAt: "2026-06-15",
        expiresAt: "2026-07-15",
      },
    ],
    privacyUrl: "/p",
    supportUrl: "/s",
    updatedAt: "2026-01-01",
  };

  const FIXTURE_STATS = [
    { value: "111", label: { tr: "Bir", en: "One" }, claimId: "second-claim" },
    { value: "222", label: { tr: "İki", en: "Two" }, claimId: "first-claim" },
  ];

  function renderFixture(now: Date) {
    return render(
      <StatCards
        slug="fixture"
        stats={FIXTURE_STATS}
        record={FIXTURE_RECORD}
        locale="en"
        now={now}
        labels={LABELS}
      />,
    );
  }

  it("shows each stat its OWN claim's date, not the first claim's", () => {
    // The stat listed first links to the SECOND claim, so claims[0] would
    // print 2026-01-01 under it.
    renderFixture(new Date("2026-01-20T12:00:00+03:00"));
    const one = screen.getByText("111").closest("div")!.parentElement!;
    expect(one.textContent).toContain("verified 2026-06-15");
    expect(one.textContent).not.toContain("2026-01-01");
  });

  it("stales each stat on its own claim's schedule", () => {
    // 2026-02-02: the first claim has lapsed, the second has not.
    renderFixture(new Date("2026-02-02T12:00:00+03:00"));
    const one = screen.getByText("111").closest("div")!.parentElement!;
    const two = screen.getByText("222").closest("div")!.parentElement!;
    expect(one.textContent).toContain("verified 2026-06-15");
    expect(two.textContent).toContain("needs re-verification");
    expect(screen.getAllByText(/needs re-verification/i)).toHaveLength(1);
  });

  it("stales the other one later, on its own date", () => {
    renderFixture(new Date("2026-07-16T12:00:00+03:00"));
    expect(screen.getAllByText(/needs re-verification/i)).toHaveLength(2);
  });
});

describe("a stat without a claim reference", () => {
  it("renders plainly, with no invented provenance", () => {
    const { config } = product("lifeos");
    const domains = config.stats.find((stat) => stat.value === "5")!;
    expect(domains.claimId).toBeUndefined();
    renderFor("lifeos", new Date("2026-08-25T12:00:00+03:00"));
    const card = screen.getByText("5").closest("div")!.parentElement!;
    expect(card.textContent).not.toMatch(/verified/i);
  });

  it("still renders the value", () => {
    renderFor("lifeos", new Date("2026-08-25T12:00:00+03:00"));
    expect(screen.getByText("5")).toBeTruthy();
  });
});

describe("empty and degraded cases", () => {
  it("renders nothing when a product has no stats", () => {
    const { container } = render(
      <StatCards slug="x" stats={[]} record={undefined} locale="en" now={new Date()} labels={LABELS} />,
    );
    expect(container.querySelector("section")).toBeNull();
  });

  it("does not crash, or invent provenance, without a registry record", () => {
    const { config } = product("burunfarki");
    render(
      <StatCards
        slug="burunfarki"
        stats={config.stats}
        record={undefined}
        locale="en"
        now={new Date()}
        labels={LABELS}
      />,
    );
    expect(screen.getByText("~%62")).toBeTruthy();
    expect(screen.queryByText(/verified/i)).toBeNull();
  });
});
