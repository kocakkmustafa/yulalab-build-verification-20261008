import { describe, expect, it } from "vitest";
import { isExpired, SITE_TIME_ZONE } from "@/lib/public-registry";
import { presentClaims } from "@/lib/proof";
import { publicRegistry } from "@/data/public-registry";

/**
 * `expiresAt` is documented in types.ts as "the ISO date AFTER WHICH this
 * must be re-confirmed", and 100% of registry values are date-only
 * (YYYY-MM-DD). Comparing timestamps got that wrong: `new Date("2026-08-22")`
 * is UTC midnight, which is 03:00 in Istanbul, so a claim went stale at 3am
 * ON its expiry date — every 30-day window was really 29 days and 3 hours
 * here, and shorter still west of UTC.
 *
 * The rule is now a date comparison in the site's declared zone, not a
 * timestamp comparison, so there is no arithmetic left to get wrong.
 */
describe("the expiry date is valid through its own day", () => {
  it.each([
    ["just after midnight", "2026-08-22T00:05:00+03:00"],
    ["midday", "2026-08-22T12:00:00+03:00"],
    ["one second before midnight", "2026-08-22T23:59:59+03:00"],
  ])("is NOT expired at %s on the expiry date", (_label, instant) => {
    expect(isExpired("2026-08-22", new Date(instant))).toBe(false);
  });

  it("IS expired once the next day starts in the site's zone", () => {
    expect(isExpired("2026-08-22", new Date("2026-08-23T00:00:01+03:00"))).toBe(true);
  });

  it("was already expired on any later day", () => {
    expect(isExpired("2026-08-22", new Date("2026-09-01T09:00:00+03:00"))).toBe(true);
  });

  it("is not expired before the date arrives", () => {
    expect(isExpired("2026-08-22", new Date("2026-08-21T23:59:00+03:00"))).toBe(false);
  });

  it("declares which zone it judges dates in", () => {
    // A silent implicit zone is how the original bug hid: it depended on the
    // server's TZ, so the same claim could be lapsed for the build machine
    // and fresh for a reader.
    expect(SITE_TIME_ZONE).toBe("Europe/Istanbul");
  });

  it("does not depend on the process timezone", () => {
    // Same instant expressed in two zones must give the same verdict.
    const instant = new Date("2026-08-22T21:00:00Z"); // = 2026-08-23 00:00 Istanbul
    expect(isExpired("2026-08-22", instant)).toBe(true);
    const stillSameDay = new Date("2026-08-22T20:59:00Z"); // = 23:59 Istanbul
    expect(isExpired("2026-08-22", stillSameDay)).toBe(false);
  });
});

describe("with the real registry shape (date-only values)", () => {
  it("keeps a claim verified on the last day of its window", () => {
    const bf = publicRegistry.find((r) => r.slug === "burunfarki")!;
    const claim = bf.claims.find((c) => c.id === "burunfarki-topk-accuracy")!;
    const onExpiryDay = new Date(`${claim.expiresAt}T12:00:00+03:00`);
    const [presented] = presentClaims(
      { ...bf, claims: [claim] },
      onExpiryDay,
    );
    expect(presented.kind).toBe("verified");
  });

  it("lapses it the day after", () => {
    const bf = publicRegistry.find((r) => r.slug === "burunfarki")!;
    const claim = bf.claims.find((c) => c.id === "burunfarki-topk-accuracy")!;
    const nextDay = new Date(new Date(`${claim.expiresAt}T12:00:00+03:00`).getTime() + 86_400_000);
    const [presented] = presentClaims({ ...bf, claims: [claim] }, nextDay);
    expect(presented.kind).toBe("lapsed");
  });
});
